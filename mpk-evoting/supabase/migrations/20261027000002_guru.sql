-- Owner decision (Ahmad, 27 Oct 2026): teachers ("Guru") vote too, but they are not on the
-- roster. A teacher types their own name on the phone and votes straight away. The name is
-- stored as a voters row (kelas 'Guru', kelompok 'guru') so results, the voter list, cancel and
-- export work the same as for everyone else. One name = one vote; the phone lock still applies.

alter table public.voters drop constraint voters_kelompok_check;
alter table public.voters add constraint voters_kelompok_check
  check (kelompok in ('pimpinan', 'guru', 'ketua_eskul', 'perwakilan_kelas', 'osis_mpk_lama', 'calon_osis_mpk'));

create or replace function public.kelompok_label(p_kelompok text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kelompok
    when 'pimpinan' then 'Pimpinan'
    when 'guru' then 'Guru'
    when 'ketua_eskul' then 'Ketua Eskul'
    when 'perwakilan_kelas' then 'Perwakilan Kelas'
    when 'osis_mpk_lama' then 'OSIS/MPK 2025/2026'
    when 'calon_osis_mpk' then 'Calon OSIS/MPK 2026/2027'
    else p_kelompok
  end
$$;

-- Teachers are typed in, not picked, so the phones do not need their names.
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
   where v.kelompok <> 'guru'
$$;

-- Teacher vote: finds or creates the teacher's row, then goes through cast_vote_voter() so every
-- check (status, candidate, one vote per person, retry by submission_id) stays in one place.
-- If the vote is refused, the new row is rolled back with it.
create or replace function public.cast_vote_guru(p_nama text, p_candidate_id uuid, p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nama text := regexp_replace(trim(coalesce(p_nama, '')), '\s+', ' ', 'g');
  v_voter_id uuid;
begin
  if length(v_nama) < 3 or length(v_nama) > 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  -- Two phones typing the same name at once must end up on the same row.
  perform pg_advisory_xact_lock(hashtextextended('guru:' || lower(v_nama), 0));

  select id into v_voter_id from public.voters
   where kelompok = 'guru' and lower(trim(nama)) = lower(v_nama);
  if not found then
    insert into public.voters (nama, kelas, kelompok)
    values (v_nama, 'Guru', 'guru')
    on conflict do nothing
    returning id into v_voter_id;
    if v_voter_id is null then
      -- The name is already on the roster with kelas 'Guru' under another group.
      raise exception 'already_voted' using errcode = 'P0001';
    end if;
  end if;

  return public.cast_vote_voter(v_voter_id, p_candidate_id, p_submission_id)
         || jsonb_build_object('voter_id', v_voter_id);
end;
$$;

-- A teacher row exists only because of a vote: when that vote goes (cancel, end of trial,
-- reset), the row goes too, so turnout and the voter list stay honest.
create or replace function public.drop_guru_without_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.voters v
   where v.id = old.voter_id
     and v.kelompok = 'guru'
     and not exists (select 1 from public.votes x where x.voter_id = v.id);
  return null;
end;
$$;

create trigger votes_drop_guru_without_vote
  after delete on public.votes
  for each row execute function public.drop_guru_without_vote();

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
            from (values ('pimpinan', 0), ('guru', 1), ('ketua_eskul', 2), ('perwakilan_kelas', 3),
                         ('osis_mpk_lama', 4), ('calon_osis_mpk', 5)) as k (kelompok, ord)
        ) g
    ), '[]'::jsonb),
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.cast_vote_guru(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cast_vote_guru(text, uuid, uuid) to service_role;
revoke execute on function public.drop_guru_without_vote() from public, anon, authenticated;
