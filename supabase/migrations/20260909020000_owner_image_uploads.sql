-- ═══════════════════════════════════════════════════════════════════════════
-- Owner-writable image uploads: vendor portfolio, event cover, aso-ebi
-- fabric swatch, brand logo.
-- ---------------------------------------------------------------------------
-- Four upload paths the app never had a code path for. Mirrors the existing
-- vendor-covers / catalog-images shape (see 20260430205323_*.sql and
-- 20260514020901_*.sql): one bucket per purpose, public read (bucket is
-- public so no explicit SELECT policy is needed — see
-- 20260514015343_*.sql), write restricted to the owning user (or an admin).
--
-- Three of the four buckets are folder-scoped by `auth.uid()` directly
-- (storage.foldername(name))[1] = auth.uid()::text) because the uploader IS
-- the row owner (events.owner_id, aso_ebi_campaigns.owner_id, brands.owner_id
-- all reference auth.users directly). Vendors are not owned by a single user
-- column — a vendor is linked to a brand via brand_vendors, and the brand
-- carries owner_id — so vendor-portfolio's write policy instead checks that
-- the top-level folder segment (the vendor id) belongs to a brand the
-- uploader owns.
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------- new columns ----------
alter table public.events add column if not exists cover_url text;
comment on column public.events.cover_url is 'Optional event cover photo, uploaded to the event-covers bucket.';

alter table public.aso_ebi_campaigns add column if not exists swatch_url text;
comment on column public.aso_ebi_campaigns.swatch_url is 'Optional fabric swatch photo, uploaded to the aso-ebi-swatches bucket.';

-- ---------- buckets ----------
insert into storage.buckets (id, name, public) values
  ('event-covers', 'event-covers', true),
  ('brand-logos', 'brand-logos', true),
  ('vendor-portfolio', 'vendor-portfolio', true),
  ('aso-ebi-swatches', 'aso-ebi-swatches', true)
on conflict (id) do nothing;

-- ---------- event-covers: folder = auth.uid() (events.owner_id) ----------
drop policy if exists "event_covers_owner_insert" on storage.objects;
create policy "event_covers_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'event-covers'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

drop policy if exists "event_covers_owner_update" on storage.objects;
create policy "event_covers_owner_update" on storage.objects
  for update using (
    bucket_id = 'event-covers'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

drop policy if exists "event_covers_owner_delete" on storage.objects;
create policy "event_covers_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'event-covers'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

-- ---------- brand-logos: folder = auth.uid() (brands.owner_id) ----------
drop policy if exists "brand_logos_owner_insert" on storage.objects;
create policy "brand_logos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'brand-logos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

drop policy if exists "brand_logos_owner_update" on storage.objects;
create policy "brand_logos_owner_update" on storage.objects
  for update using (
    bucket_id = 'brand-logos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

drop policy if exists "brand_logos_owner_delete" on storage.objects;
create policy "brand_logos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'brand-logos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

-- ---------- aso-ebi-swatches: folder = auth.uid() (aso_ebi_campaigns.owner_id) ----------
drop policy if exists "asoebi_swatches_owner_insert" on storage.objects;
create policy "asoebi_swatches_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'aso-ebi-swatches'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

drop policy if exists "asoebi_swatches_owner_update" on storage.objects;
create policy "asoebi_swatches_owner_update" on storage.objects
  for update using (
    bucket_id = 'aso-ebi-swatches'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

drop policy if exists "asoebi_swatches_owner_delete" on storage.objects;
create policy "asoebi_swatches_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'aso-ebi-swatches'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin(auth.uid()))
  );

-- ---------- vendor-portfolio: folder = vendor id, owner via brand_vendors ----------
create or replace function public.owns_vendor(_vendor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.brand_vendors bv
    join public.brands b on b.id = bv.brand_id
    where bv.vendor_id = _vendor and b.owner_id = auth.uid()
  );
$$;
revoke execute on function public.owns_vendor(uuid) from anon, public;
grant execute on function public.owns_vendor(uuid) to authenticated;

drop policy if exists "vendor_portfolio_owner_insert" on storage.objects;
create policy "vendor_portfolio_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'vendor-portfolio'
    and (public.owns_vendor(((storage.foldername(name))[1])::uuid) or public.is_admin(auth.uid()))
  );

drop policy if exists "vendor_portfolio_owner_update" on storage.objects;
create policy "vendor_portfolio_owner_update" on storage.objects
  for update using (
    bucket_id = 'vendor-portfolio'
    and (public.owns_vendor(((storage.foldername(name))[1])::uuid) or public.is_admin(auth.uid()))
  );

drop policy if exists "vendor_portfolio_owner_delete" on storage.objects;
create policy "vendor_portfolio_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'vendor-portfolio'
    and (public.owns_vendor(((storage.foldername(name))[1])::uuid) or public.is_admin(auth.uid()))
  );

-- vendor_portfolio (table) previously allowed writes from admins only —
-- brand owners can now manage their own vendor's portfolio rows too.
drop policy if exists "portfolio_owner_write" on public.vendor_portfolio;
create policy "portfolio_owner_write" on public.vendor_portfolio
  for all
  using (public.owns_vendor(vendor_portfolio.vendor_id) or public.is_admin(auth.uid()))
  with check (public.owns_vendor(vendor_portfolio.vendor_id) or public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
