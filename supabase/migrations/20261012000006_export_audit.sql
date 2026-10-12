-- Lets admins record result exports in the audit log (write_audit itself is not callable from the API).

create or replace function public.log_export(p_format text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  if p_format not in ('csv', 'pdf') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  perform public.write_audit(format('Mengekspor hasil (%s)', upper(p_format)));
end;
$$;

revoke execute on function public.log_export(text) from public, anon, authenticated;
grant execute on function public.log_export(text) to authenticated;
