-- Row Level Security and explicit grants for the Supabase Data API.
-- Principle: start from zero access, then grant only what each role needs.

alter table public.candidates enable row level security;
alter table public.election enable row level security;
alter table public.votes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.results_version enable row level security;

-- ---------------------------------------------------------------------------
-- Remove every default privilege first (Supabase may auto-grant to anon/authenticated).
-- ---------------------------------------------------------------------------
revoke all on table
  public.candidates, public.election, public.votes, public.audit_logs, public.results_version
  from public, anon, authenticated;

revoke all on all sequences in schema public from public, anon, authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants (anon gets nothing at all)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

-- candidates: admin + bilik read; admin writes (RLS + draft trigger restrict further)
grant select on public.candidates to authenticated;
grant insert, update, delete on public.candidates to authenticated;

-- election: read-only through the API; changes only via functions
grant select on public.election to authenticated;

-- votes: NO table privileges for anon/authenticated. Votes enter only via cast_vote().

-- audit_logs: admin read-only
grant select on public.audit_logs to authenticated;

-- results_version: admin read (for Realtime subscription)
grant select on public.results_version to authenticated;

-- Functions callable through the API
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.cast_vote(uuid, uuid) to authenticated;
grant execute on function public.start_test() to authenticated;
grant execute on function public.end_test() to authenticated;
grant execute on function public.open_voting() to authenticated;
grant execute on function public.close_voting() to authenticated;
grant execute on function public.get_results() to authenticated;

-- Server-side code and local scripts
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
create policy candidates_read on public.candidates
  for select to authenticated
  using (public.current_app_role() in ('admin', 'bilik'));

create policy candidates_admin_insert on public.candidates
  for insert to authenticated
  with check (public.current_app_role() = 'admin');

create policy candidates_admin_update on public.candidates
  for update to authenticated
  using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

create policy candidates_admin_delete on public.candidates
  for delete to authenticated
  using (public.current_app_role() = 'admin');

create policy election_read on public.election
  for select to authenticated
  using (public.current_app_role() in ('admin', 'bilik'));

create policy audit_admin_read on public.audit_logs
  for select to authenticated
  using (public.current_app_role() = 'admin');

create policy results_version_admin_read on public.results_version
  for select to authenticated
  using (public.current_app_role() = 'admin');

-- votes: RLS on with no policies = no rows visible or writable for API roles.

-- ---------------------------------------------------------------------------
-- Realtime: admins listen to results_version bumps, then call get_results().
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.results_version;
alter publication supabase_realtime add table public.election;
