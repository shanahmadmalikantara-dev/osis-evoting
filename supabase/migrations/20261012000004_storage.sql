-- Candidate photos bucket. Photos are public campaign material, so reads are public;
-- only admins may upload/replace/delete, and only while the election is a draft.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidate-photos', 'candidate-photos', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.election_is_draft()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select status = 'draft' from public.election where id = 1
$$;

revoke execute on function public.election_is_draft() from public, anon, authenticated;
grant execute on function public.election_is_draft() to authenticated;

create policy candidate_photos_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'candidate-photos'
    and public.current_app_role() = 'admin'
    and public.election_is_draft()
  );

create policy candidate_photos_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'candidate-photos'
    and public.current_app_role() = 'admin'
    and public.election_is_draft()
  );

create policy candidate_photos_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'candidate-photos'
    and public.current_app_role() = 'admin'
    and public.election_is_draft()
  );
