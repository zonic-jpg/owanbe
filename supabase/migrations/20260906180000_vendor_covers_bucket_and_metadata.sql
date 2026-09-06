-- ═══════════════════════════════════════════════════════════════════════════
-- vendor-covers storage bucket + vendor cover-diversity metadata columns.
-- ---------------------------------------------------------------------------
-- supabase/functions/generate-vendor-covers/index.ts uploads to a
-- `vendor-covers` bucket and writes vendors.cover_style_variant,
-- cover_phash, cover_subject_kind and cover_subject_gender to run its
-- diversity/dedupe pipeline (aHash near-duplicate rejection, per-category
-- gender/kind balancing). Only `catalog-images` existed live and none of
-- these four columns were defined in any migration file — the function
-- would have failed on every write. Applied defensively as part of the
-- hostile-audit schema restoration; additive only.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.vendors add column if not exists cover_style_variant integer;
alter table public.vendors add column if not exists cover_phash text;
alter table public.vendors add column if not exists cover_subject_kind text;
alter table public.vendors add column if not exists cover_subject_gender text;

comment on column public.vendors.cover_style_variant is
  'Index into generate-vendor-covers STYLE_VARIANTS — drives per-category diversity rotation.';
comment on column public.vendors.cover_phash is
  '64-bit perceptual hash (hex) of the generated cover, used for Hamming-distance duplicate rejection.';
comment on column public.vendors.cover_subject_kind is
  '"person" or "object" — the subject kind of the accepted style variant.';
comment on column public.vendors.cover_subject_gender is
  '"woman" | "man" | "none" — the subject gender of the accepted style variant.';

insert into storage.buckets (id, name, public)
values ('vendor-covers', 'vendor-covers', true)
on conflict (id) do nothing;

drop policy if exists "vendor_covers_public_read" on storage.objects;
create policy "vendor_covers_public_read" on storage.objects
  for select using (bucket_id = 'vendor-covers');

drop policy if exists "vendor_covers_admin_insert" on storage.objects;
create policy "vendor_covers_admin_insert" on storage.objects
  for insert with check (bucket_id = 'vendor-covers' and public.is_admin(auth.uid()));

drop policy if exists "vendor_covers_admin_update" on storage.objects;
create policy "vendor_covers_admin_update" on storage.objects
  for update using (bucket_id = 'vendor-covers' and public.is_admin(auth.uid()));

drop policy if exists "vendor_covers_admin_delete" on storage.objects;
create policy "vendor_covers_admin_delete" on storage.objects
  for delete using (bucket_id = 'vendor-covers' and public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
