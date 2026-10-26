-- MPK election (owner decisions, Ahmad, 26 Oct 2026):
--   * voters are a fixed roster (nama, kelas, kelompok) entered by the admin; there are no booth
--     accounts. A voter picks kelompok -> kelas -> their own name on a phone and votes once.
--   * the admin may see who voted and for whom, and may cancel one person's vote (audit logged)
--     so that person can vote again.
-- The voter page has no Supabase session: it talks to the server, which calls the voter functions
-- below with the service_role key. anon/authenticated cannot execute them.

-- ---------------------------------------------------------------------------
-- Roster
-- ---------------------------------------------------------------------------
create table public.voters (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (length(trim(nama)) between 1 and 120),
  kelas text not null check (length(trim(kelas)) between 1 and 60),
  kelompok text not null check (kelompok in ('ketua_eskul', 'perwakilan_kelas', 'osis_mpk_lama', 'calon_osis_mpk')),
  created_at timestamptz not null default now()
);

-- One person = one row, even when they belong to two groups.
create unique index voters_person_uq on public.voters (lower(trim(nama)), lower(trim(kelas)));
create index voters_kelompok_idx on public.voters (kelompok, kelas, nama);

-- ---------------------------------------------------------------------------
-- Votes now belong to a voter instead of a booth account.
-- ---------------------------------------------------------------------------
drop function if exists public.cast_vote(uuid, uuid);

alter table public.votes alter column bilik_id drop not null;
alter table public.votes add column voter_id uuid not null references public.voters (id) on delete restrict;
-- One real vote and (during a trial run) one test vote per person.
create unique index votes_voter_mode_uq on public.votes (voter_id, is_test);

-- Real votes may be deleted only by reset_election() or cancel_vote(), which raise a
-- transaction-local flag. UPDATE and TRUNCATE stay forbidden for every role.
create or replace function public.guard_votes_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' and not old.is_test
     and coalesce(current_setting('app.reset_election', true), '') <> 'on'
     and coalesce(current_setting('app.cancel_vote', true), '') <> 'on' then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'TRUNCATE' then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create or replace function public.kelompok_label(p_kelompok text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kelompok
    when 'ketua_eskul' then 'Ketua Eskul'
    when 'perwakilan_kelas' then 'Perwakilan Kelas'
    when 'osis_mpk_lama' then 'OSIS/MPK 2025/2026'
    when 'calon_osis_mpk' then 'Calon OSIS/MPK 2026/2027'
    else p_kelompok
  end
$$;

-- ---------------------------------------------------------------------------
-- Voter side (service_role only, called by the server)
-- ---------------------------------------------------------------------------

-- Roster for the voter page with a "voted" flag for the current mode (trial or real).
create or replace function public.voter_roster()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id,
           'nama', v.nama,
           'kelas', v.kelas,
           'kelompok', v.kelompok,
           'voted', exists (
             select 1 from public.votes x
              where x.voter_id = v.id
                and x.is_test = (select e.test_mode from public.election e where e.id = 1))
         ) order by v.kelompok, v.kelas, v.nama), '[]'::jsonb)
    from public.voters v
$$;

create or replace function public.voter_has_voted(p_voter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.votes x
     where x.voter_id = p_voter_id
       and x.is_test = (select e.test_mode from public.election e where e.id = 1))
$$;

-- The ONLY way a vote enters the database.
create or replace function public.cast_vote_voter(p_voter_id uuid, p_candidate_id uuid, p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_election public.election%rowtype;
  v_existing public.votes%rowtype;
begin
  if p_voter_id is null or p_candidate_id is null or p_submission_id is null then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  -- Serialize per voter so two phones choosing the same name cannot both get through.
  perform pg_advisory_xact_lock(hashtextextended(p_voter_id::text, 0));

  -- A retry of the same click (same submission_id) is a success, not a new vote.
  select * into v_existing from public.votes where submission_id = p_submission_id;
  if found then
    if v_existing.voter_id = p_voter_id then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
    raise exception 'submission_conflict' using errcode = 'P0001';
  end if;

  select * into v_election from public.election where id = 1 for share;
  if v_election.status <> 'open' then
    raise exception 'election_not_open' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.voters where id = p_voter_id) then
    raise exception 'voter_not_found' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.candidates where id = p_candidate_id) then
    raise exception 'invalid_candidate' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.votes where voter_id = p_voter_id and is_test = v_election.test_mode) then
    raise exception 'already_voted' using errcode = 'P0001';
  end if;

  insert into public.votes (candidate_id, voter_id, submission_id, is_test, created_at)
  values (p_candidate_id, p_voter_id, p_submission_id, v_election.test_mode, clock_timestamp());

  update public.results_version set version = version + 1, updated_at = now() where id = 1;

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin side
-- ---------------------------------------------------------------------------

-- Results with turnout per group instead of votes per booth.
create or replace function public.get_results()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_election public.election%rowtype;
  v_result jsonb;
begin
  perform public.assert_admin();
  select * into v_election from public.election where id = 1;

  with counted as (
    select v.candidate_id, v.voter_id
      from public.votes v
     where v.is_test = v_election.test_mode
  )
  select jsonb_build_object(
    'status', v_election.status,
    'test_mode', v_election.test_mode,
    'opened_at', v_election.opened_at,
    'closed_at', v_election.closed_at,
    'total', (select count(*) from counted),
    'voters_total', (select count(*) from public.voters),
    'candidates', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id,
               'nomor_urut', c.nomor_urut,
               'nama_ketua', c.nama_ketua,
               'nama_wakil', c.nama_wakil,
               'votes', (select count(*) from counted k where k.candidate_id = c.id)
             ) order by c.nomor_urut)
        from public.candidates c
    ), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kelompok', g.kelompok,
               'label', public.kelompok_label(g.kelompok),
               'total', g.total,
               'voted', g.voted
             ) order by g.ord)
        from (
          select k.kelompok, k.ord,
                 (select count(*) from public.voters v where v.kelompok = k.kelompok) as total,
                 (select count(*) from counted c join public.voters v on v.id = c.voter_id
                   where v.kelompok = k.kelompok) as voted
            from (values ('ketua_eskul', 1), ('perwakilan_kelas', 2),
                         ('osis_mpk_lama', 3), ('calon_osis_mpk', 4)) as k (kelompok, ord)
        ) g
    ), '[]'::jsonb),
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

-- Everyone on the roster, with their vote in the current mode (owner decision: admins may see it).
create or replace function public.list_voters()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_test boolean;
begin
  perform public.assert_admin();
  select test_mode into v_test from public.election where id = 1;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', v.id,
             'nama', v.nama,
             'kelas', v.kelas,
             'kelompok', v.kelompok,
             'voted_at', x.created_at,
             'nomor_urut', c.nomor_urut
           ) order by x.created_at desc nulls last, v.kelompok, v.kelas, v.nama)
      from public.voters v
      left join public.votes x on x.voter_id = v.id and x.is_test = v_test
      left join public.candidates c on c.id = x.candidate_id
  ), '[]'::jsonb);
end;
$$;

-- Adds roster rows: [{"nama":..,"kelas":..,"kelompok":..}]. Rows already on the roster
-- (same nama + kelas) are skipped and reported back. Not allowed after voting is closed.
create or replace function public.import_voters(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_row jsonb;
  v_nama text;
  v_kelas text;
  v_kelompok text;
  v_inserted integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  perform public.assert_admin();
  select status into v_status from public.election where id = 1 for share;
  if v_status = 'closed' then
    raise exception 'roster_locked' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 3000 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_nama := regexp_replace(trim(coalesce(v_row ->> 'nama', '')), '\s+', ' ', 'g');
    v_kelas := regexp_replace(trim(coalesce(v_row ->> 'kelas', '')), '\s+', ' ', 'g');
    v_kelompok := v_row ->> 'kelompok';
    if v_nama = '' or v_kelas = '' or length(v_nama) > 120 or length(v_kelas) > 60
       or v_kelompok is null
       or v_kelompok not in ('ketua_eskul', 'perwakilan_kelas', 'osis_mpk_lama', 'calon_osis_mpk') then
      raise exception 'invalid_input' using errcode = 'P0001';
    end if;
    insert into public.voters (nama, kelas, kelompok)
    values (v_nama, v_kelas, v_kelompok)
    on conflict do nothing;
    if found then
      v_inserted := v_inserted + 1;
    else
      v_skipped := v_skipped || jsonb_build_object('nama', v_nama, 'kelas', v_kelas);
    end if;
  end loop;

  perform public.write_audit(format('Menambah %s pemilih ke daftar', v_inserted));
  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

-- Removes a roster entry that has no vote (typo, wrong person). People with a vote must
-- have it cancelled first.
create or replace function public.delete_voter(p_voter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_voter public.voters%rowtype;
begin
  perform public.assert_admin();
  select * into v_voter from public.voters where id = p_voter_id for update;
  if not found then
    raise exception 'voter_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.votes where voter_id = p_voter_id) then
    raise exception 'voter_has_vote' using errcode = 'P0001';
  end if;
  delete from public.voters where id = p_voter_id;
  perform public.write_audit(format('Menghapus pemilih %s (%s) dari daftar', v_voter.nama, v_voter.kelas));
end;
$$;

-- Empties the roster (e.g. to replace the dummy list with the real one). Draft only, no votes.
create or replace function public.clear_voters()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_deleted integer;
begin
  perform public.assert_admin();
  select status into v_status from public.election where id = 1 for update;
  if v_status <> 'draft' then
    raise exception 'roster_locked' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.votes) then
    raise exception 'votes_not_empty' using errcode = 'P0001';
  end if;
  delete from public.voters where true;
  get diagnostics v_deleted = row_count;
  perform public.write_audit(format('Mengosongkan daftar pemilih (%s orang)', v_deleted));
  return jsonb_build_object('deleted', v_deleted);
end;
$$;

-- Cancels one person's vote in the current mode so they can vote again. Audit logged
-- (without the choice).
create or replace function public.cancel_vote(p_voter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_election public.election%rowtype;
  v_voter public.voters%rowtype;
  v_deleted integer;
begin
  perform public.assert_admin();
  select * into v_election from public.election where id = 1 for share;
  select * into v_voter from public.voters where id = p_voter_id;
  if not found then
    raise exception 'voter_not_found' using errcode = 'P0001';
  end if;

  perform set_config('app.cancel_vote', 'on', true);
  delete from public.votes where voter_id = p_voter_id and is_test = v_election.test_mode;
  get diagnostics v_deleted = row_count;
  perform set_config('app.cancel_vote', 'off', true);

  if v_deleted = 0 then
    raise exception 'no_vote' using errcode = 'P0001';
  end if;

  update public.results_version set version = version + 1, updated_at = now() where id = 1;
  perform public.write_audit(format('Membatalkan suara %s (%s)%s', v_voter.nama, v_voter.kelas,
    case when v_election.test_mode then ' [uji coba]' else '' end));
end;
$$;

-- ---------------------------------------------------------------------------
-- Security
-- ---------------------------------------------------------------------------
alter table public.voters enable row level security;
revoke all on table public.voters from public, anon, authenticated;
grant all on table public.voters to service_role;
-- No policies: API roles see no rows. Admins read the roster through list_voters().

revoke execute on function public.kelompok_label(text) from public, anon, authenticated;
revoke execute on function public.voter_roster() from public, anon, authenticated;
revoke execute on function public.voter_has_voted(uuid) from public, anon, authenticated;
revoke execute on function public.cast_vote_voter(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.list_voters() from public, anon;
revoke execute on function public.import_voters(jsonb) from public, anon;
revoke execute on function public.delete_voter(uuid) from public, anon;
revoke execute on function public.clear_voters() from public, anon;
revoke execute on function public.cancel_vote(uuid) from public, anon;

grant execute on function public.voter_roster() to service_role;
grant execute on function public.voter_has_voted(uuid) to service_role;
grant execute on function public.cast_vote_voter(uuid, uuid, uuid) to service_role;
grant execute on function public.kelompok_label(text) to service_role;
grant execute on function public.list_voters() to authenticated;
grant execute on function public.import_voters(jsonb) to authenticated;
grant execute on function public.delete_voter(uuid) to authenticated;
grant execute on function public.clear_voters() to authenticated;
grant execute on function public.cancel_vote(uuid) to authenticated;
grant execute on function public.get_results() to authenticated;
