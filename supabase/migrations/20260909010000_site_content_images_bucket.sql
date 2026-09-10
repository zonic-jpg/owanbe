-- ═══════════════════════════════════════════════════════════════════════════
-- site-content storage bucket.
-- ---------------------------------------------------------------------------
-- ContentStudio (super-admin-only landing-page editor) previously stored its
-- compressed hero image as a base64 data: URL directly inside
-- site_content.data (jsonb) — the opposite of what resizeForDevices is for
-- everywhere else in the app. It now uploads the compressed rendition to
-- this bucket and stores the resulting public URL instead. Same
-- bucket-per-purpose + admin-write/public-read shape as vendor-covers and
-- catalog-images (see 20260430205323_*.sql and 20260514020901_*.sql).
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('site-content', 'site-content', true)
on conflict (id) do nothing;

drop policy if exists "site_content_admin_insert" on storage.objects;
create policy "site_content_admin_insert" on storage.objects
  for insert with check (bucket_id = 'site-content' and public.is_admin(auth.uid()));

drop policy if exists "site_content_admin_update" on storage.objects;
create policy "site_content_admin_update" on storage.objects
  for update using (bucket_id = 'site-content' and public.is_admin(auth.uid()));

drop policy if exists "site_content_admin_delete" on storage.objects;
create policy "site_content_admin_delete" on storage.objects
  for delete using (bucket_id = 'site-content' and public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
