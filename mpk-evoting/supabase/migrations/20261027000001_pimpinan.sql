-- Owner decision (Ahmad, 27 Oct 2026): school leaders ("Pimpinan") vote too.
-- They have no class; their roster rows use kelas = 'Pimpinan' and the voter page skips the
-- class step when a group has a single class.

alter table public.voters drop constraint voters_kelompok_check;
alter table public.voters add constraint voters_kelompok_check
  check (kelompok in ('pimpinan', 'ketua_eskul', 'perwakilan_kelas', 'osis_mpk_lama', 'calon_osis_mpk'));

create or replace function public.kelompok_label(p_kelompok text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kelompok
    when 'pimpinan' then 'Pimpinan'
    when 'ketua_eskul' then 'Ketua Eskul'
    when 'perwakilan_kelas' then 'Perwakilan Kelas'
    when 'osis_mpk_lama' then 'OSIS/MPK 2025/2026'
    when 'calon_osis_mpk' then 'Calon OSIS/MPK 2026/2027'
    else p_kelompok
  end
$$;

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
            from (values ('pimpinan', 0), ('ketua_eskul', 1), ('perwakilan_kelas', 2),
                         ('osis_mpk_lama', 3), ('calon_osis_mpk', 4)) as k (kelompok, ord)
        ) g
    ), '[]'::jsonb),
    'generated_at', now()
  ) into v_result;

  return v_result;
end;
$$;

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
       or v_kelompok not in ('pimpinan', 'ketua_eskul', 'perwakilan_kelas', 'osis_mpk_lama', 'calon_osis_mpk') then
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
