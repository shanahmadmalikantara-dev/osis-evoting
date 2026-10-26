-- Voting and admin functions. All writes to votes and election go through these.
-- Errors are raised with short English keys that the app maps to Indonesian text.

-- ---------------------------------------------------------------------------
-- cast_vote: the ONLY way a vote enters the database.
-- ---------------------------------------------------------------------------
create or replace function public.cast_vote(p_candidate_id uuid, p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bilik uuid := auth.uid();
  v_election public.election%rowtype;
  v_existing public.votes%rowtype;
  v_last timestamptz;
begin
  if public.current_app_role() <> 'bilik' or v_bilik is null then
    raise exception 'not_bilik' using errcode = 'P0001';
  end if;

  if p_candidate_id is null or p_submission_id is null then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  -- Serialize votes per booth so the cooldown check cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(v_bilik::text, 0));

  -- A retry of the same click (same submission_id) is a success, not a new vote.
  select * into v_existing from public.votes where submission_id = p_submission_id;
  if found then
    if v_existing.bilik_id = v_bilik then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
    raise exception 'submission_conflict' using errcode = 'P0001';
  end if;

  select * into v_election from public.election where id = 1 for share;
  if v_election.status <> 'open' then
    raise exception 'election_not_open' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.candidates where id = p_candidate_id) then
    raise exception 'invalid_candidate' using errcode = 'P0001';
  end if;

  select max(created_at) into v_last from public.votes where bilik_id = v_bilik;
  if v_last is not null
     and clock_timestamp() - v_last < make_interval(secs => v_election.vote_cooldown_seconds) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.votes (candidate_id, bilik_id, submission_id, is_test, created_at)
  values (p_candidate_id, v_bilik, p_submission_id, v_election.test_mode, clock_timestamp());

  update public.results_version set version = version + 1, updated_at = now() where id = 1;

  return jsonb_build_object('ok', true, 'duplicate', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin helpers
-- ---------------------------------------------------------------------------
create or replace function public.assert_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if public.current_app_role() <> 'admin' then
    raise exception 'not_admin' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.write_audit(p_aksi text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (aktor, aksi) values (public.current_actor(), p_aksi);
$$;

-- ---------------------------------------------------------------------------
-- Election lifecycle
-- ---------------------------------------------------------------------------

-- draft -> open (trial run). Votes are flagged is_test and never counted officially.
create or replace function public.start_test()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.assert_admin();
  select status into v_status from public.election where id = 1 for update;
  if v_status <> 'draft' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.candidates) then
    raise exception 'no_candidates' using errcode = 'P0001';
  end if;
  update public.election
     set status = 'open', test_mode = true, updated_at = now()
   where id = 1;
  perform public.write_audit('Memulai mode uji coba');
end;
$$;

-- open (trial) -> draft, removing only the test votes.
create or replace function public.end_test()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_election public.election%rowtype;
  v_deleted integer;
begin
  perform public.assert_admin();
  select * into v_election from public.election where id = 1 for update;
  if v_election.status <> 'open' or not v_election.test_mode then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  delete from public.votes where is_test;
  get diagnostics v_deleted = row_count;
  update public.election
     set status = 'draft', test_mode = false, updated_at = now()
   where id = 1;
  update public.results_version set version = version + 1, updated_at = now() where id = 1;
  perform public.write_audit(format('Mengakhiri mode uji coba (%s suara uji dibersihkan)', v_deleted));
  return jsonb_build_object('deleted_test_votes', v_deleted);
end;
$$;

-- draft -> open (real). One-way: there is no path back to draft after this.
create or replace function public.open_voting()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.assert_admin();
  select status into v_status from public.election where id = 1 for update;
  if v_status <> 'draft' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.candidates) then
    raise exception 'no_candidates' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.votes) then
    raise exception 'votes_not_empty' using errcode = 'P0001';
  end if;
  update public.election
     set status = 'open', test_mode = false, opened_at = now(), updated_at = now()
   where id = 1;
  perform public.write_audit('Membuka pemungutan suara');
end;
$$;

-- open (real) -> closed. Final.
create or replace function public.close_voting()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_election public.election%rowtype;
begin
  perform public.assert_admin();
  select * into v_election from public.election where id = 1 for update;
  if v_election.status <> 'open' or v_election.test_mode then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  update public.election
     set status = 'closed', closed_at = now(), updated_at = now()
   where id = 1;
  perform public.write_audit('Menutup pemungutan suara');
end;
$$;

-- ---------------------------------------------------------------------------
-- Results: admins get aggregates only, never individual vote rows.
-- In test mode the trial votes are shown; otherwise only real votes.
-- ---------------------------------------------------------------------------
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
    select v.candidate_id, v.bilik_id
      from public.votes v
     where v.is_test = v_election.test_mode
  )
  select jsonb_build_object(
    'status', v_election.status,
    'test_mode', v_election.test_mode,
    'opened_at', v_election.opened_at,
    'closed_at', v_election.closed_at,
    'total', (select count(*) from counted),
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
    'booths', coalesce((
      select jsonb_agg(jsonb_build_object(
               'bilik_id', b.id,
               'label', split_part(b.email, '@', 1),
               'votes', (select count(*) from counted k where k.bilik_id = b.id)
             ) order by b.email)
        from auth.users b
       where b.raw_app_meta_data ->> 'role' = 'bilik'
    ), '[]'::jsonb),
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;
