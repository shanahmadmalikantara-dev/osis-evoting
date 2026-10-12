-- E-voting schema: candidates, election, votes, audit_logs.
-- Votes never contain voter identity. Only the booth (bilik) account id is stored.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Role comes from app_metadata, which users cannot change themselves.
create or replace function public.current_app_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

create or replace function public.current_actor()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(auth.jwt() ->> 'email', ''), 'sistem')
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  nomor_urut integer not null unique check (nomor_urut > 0),
  nama_ketua text not null check (length(trim(nama_ketua)) > 0),
  nama_wakil text not null check (length(trim(nama_wakil)) > 0),
  foto_url text,
  visi_misi text not null default '',
  created_at timestamptz not null default now()
);

-- Single-row table holding the election state.
-- Lifecycle: draft -> open (test) -> draft  (trial run, test votes purged)
--            draft -> open (real) -> closed (one-way, final)
create table public.election (
  id integer primary key default 1 check (id = 1),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  test_mode boolean not null default false,
  -- Minimum seconds between two votes from the same booth. Only the DB owner can change it.
  vote_cooldown_seconds integer not null default 8 check (vote_cooldown_seconds >= 0),
  opened_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (not (test_mode and status <> 'open'))
);

insert into public.election (id) values (1);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete restrict,
  bilik_id uuid not null,
  submission_id uuid not null unique,
  is_test boolean not null default false,
  created_at timestamptz not null default now()
);

create index votes_bilik_created_idx on public.votes (bilik_id, created_at desc);
create index votes_candidate_idx on public.votes (candidate_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  aktor text not null,
  aksi text not null,
  waktu timestamptz not null default now()
);

create index audit_logs_waktu_idx on public.audit_logs (waktu desc);

-- Bumped on every vote so the admin dashboard can subscribe via Realtime
-- without being able to read individual vote rows.
create table public.results_version (
  id integer primary key default 1 check (id = 1),
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.results_version (id) values (1);

-- ---------------------------------------------------------------------------
-- Integrity guards (apply to every role, including service_role)
-- ---------------------------------------------------------------------------

create or replace function public.guard_votes_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' and not old.is_test then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'TRUNCATE' then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger votes_no_update
  before update on public.votes
  for each row execute function public.guard_votes_immutable();

create trigger votes_no_delete_real
  before delete on public.votes
  for each row execute function public.guard_votes_immutable();

create trigger votes_no_truncate
  before truncate on public.votes
  for each statement execute function public.guard_votes_immutable();

create or replace function public.guard_audit_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs_are_append_only' using errcode = 'P0001';
end;
$$;

create trigger audit_no_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.guard_audit_append_only();

create trigger audit_no_truncate
  before truncate on public.audit_logs
  for each statement execute function public.guard_audit_append_only();

-- Candidates can only change while the election is a draft.
create or replace function public.guard_candidates_draft_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.election where id = 1;
  if v_status <> 'draft' then
    raise exception 'candidates_locked' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger candidates_draft_only
  before insert or update or delete on public.candidates
  for each row execute function public.guard_candidates_draft_only();

-- Every candidate change is written to the audit log.
create or replace function public.audit_candidates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (aktor, aksi)
    values (public.current_actor(),
            format('Menambah paslon %s: %s & %s', new.nomor_urut, new.nama_ketua, new.nama_wakil));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (aktor, aksi)
    values (public.current_actor(),
            format('Mengubah paslon %s: %s & %s', new.nomor_urut, new.nama_ketua, new.nama_wakil));
  else
    insert into public.audit_logs (aktor, aksi)
    values (public.current_actor(),
            format('Menghapus paslon %s: %s & %s', old.nomor_urut, old.nama_ketua, old.nama_wakil));
  end if;
  return null;
end;
$$;

create trigger candidates_audit
  after insert or update or delete on public.candidates
  for each row execute function public.audit_candidates();
