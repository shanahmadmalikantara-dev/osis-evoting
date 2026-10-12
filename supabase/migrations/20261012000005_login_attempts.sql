-- Login rate limiting (admin and bilik). Used only by server code with the service_role key.
-- Keys are SHA-256 hashes of "email:<email>" or "ip:<ip>", so no raw IPs are stored.

create table public.login_attempts (
  id bigint generated always as identity primary key,
  key_hash text not null,
  attempted_at timestamptz not null default now()
);

create index login_attempts_key_time_idx on public.login_attempts (key_hash, attempted_at desc);

alter table public.login_attempts enable row level security;
revoke all on table public.login_attempts from public, anon, authenticated;
grant all on table public.login_attempts to service_role;

-- True when any key has reached p_max failures inside the window.
create or replace function public.login_is_blocked(p_keys text[], p_max integer, p_window_seconds integer)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.login_attempts
     where key_hash = any (p_keys)
       and attempted_at > now() - make_interval(secs => p_window_seconds)
     group by key_hash
    having count(*) >= p_max
  )
$$;

create or replace function public.login_record_failure(p_keys text[])
returns void
language sql
set search_path = ''
as $$
  delete from public.login_attempts where attempted_at < now() - interval '1 day';
  insert into public.login_attempts (key_hash) select unnest(p_keys);
$$;

create or replace function public.login_clear(p_keys text[])
returns void
language sql
set search_path = ''
as $$
  delete from public.login_attempts where key_hash = any (p_keys);
$$;

revoke execute on function public.login_is_blocked(text[], integer, integer) from public, anon, authenticated;
revoke execute on function public.login_record_failure(text[]) from public, anon, authenticated;
revoke execute on function public.login_clear(text[]) from public, anon, authenticated;
grant execute on function public.login_is_blocked(text[], integer, integer) to service_role;
grant execute on function public.login_record_failure(text[]) to service_role;
grant execute on function public.login_clear(text[]) to service_role;
