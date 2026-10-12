-- Storage needs SELECT on the object to replace or delete it. Public URLs keep working without this.
create policy candidate_photos_admin_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'candidate-photos'
    and public.current_app_role() = 'admin'
  );
