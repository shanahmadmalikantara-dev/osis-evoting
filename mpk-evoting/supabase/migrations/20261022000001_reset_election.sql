-- Owner decision (Ahmad, 22 Oct 2026): after an election is CLOSED, an admin may wipe all votes
-- from the dashboard to reuse the app. Guard rails:
--   * only through reset_election(), only for admins, only while status = 'closed'
--     (never during voting), and only with the exact typed confirmation phrase;
--   * the votes table stays immutable for everything else (no UPDATE, no TRUNCATE, no direct
--     DELETE of real votes for any role, admin has no DELETE privilege at all);
--   * the reset is written to the append-only audit log with the number of votes removed.

-- Real votes may only be deleted while reset_election() has raised this transaction-local flag.
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
     and coalesce(current_setting('app.reset_election', true), '') <> 'on' then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'TRUNCATE' then
    raise exception 'votes_are_immutable' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

-- closed -> draft, deleting every vote. Export the results first: this cannot be undone.
create or replace function public.reset_election(p_confirm text)
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
  if v_status <> 'closed' then
    raise exception 'reset_only_when_closed' using errcode = 'P0001';
  end if;
  if p_confirm is distinct from 'HAPUS SEMUA SUARA' then
    raise exception 'reset_confirm_mismatch' using errcode = 'P0001';
  end if;

  perform set_config('app.reset_election', 'on', true);
  -- "where true": Supabase loads pg-safeupdate for API calls, which rejects a DELETE without WHERE.
  delete from public.votes where true;
  get diagnostics v_deleted = row_count;
  perform set_config('app.reset_election', 'off', true);

  update public.election
     set status = 'draft', test_mode = false, opened_at = null, closed_at = null, updated_at = now()
   where id = 1;
  update public.results_version set version = version + 1, updated_at = now() where id = 1;
  perform public.write_audit(format('Menghapus semua data suara (%s suara) dan mengembalikan status ke draft', v_deleted));
  return jsonb_build_object('deleted_votes', v_deleted);
end;
$$;

revoke execute on function public.reset_election(text) from public, anon;
grant execute on function public.reset_election(text) to authenticated;
