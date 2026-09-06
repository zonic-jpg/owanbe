-- ═══════════════════════════════════════════════════════════════════════════
-- WIDEN vendor_category: schema/code drift found in a hostile audit.
-- ---------------------------------------------------------------------------
-- 20260428010747_ea8adf98-...sql defined public.vendor_category with only 13
-- values: decor, catering, photography, dj, mc, makeup, aso_ebi, cake, venue,
-- drinks, security, logistics, souvenirs.
--
-- But both supabase/functions/seed-catalog/index.ts (CATALOG + PAD objects)
-- and supabase/functions/generate-vendor-covers/index.ts (CATEGORY_PROMPTS)
-- independently use a ~33-category taxonomy. catalog_products.category and
-- vendors.category are both typed vendor_category NOT NULL, so every one of
-- the 20 categories below would have failed with an enum-invalid-input error
-- the moment either edge function tried to write it. Confirmed via grep
-- across every migration file: no wider/alternate enum was ever defined —
-- this is a genuine pre-existing gap, not a deliberate restriction.
--
-- Additive only; existing rows and the 13 original values are untouched.
-- ═══════════════════════════════════════════════════════════════════════════

alter type public.vendor_category add value if not exists 'planner';
alter type public.vendor_category add value if not exists 'proposal_planner';
alter type public.vendor_category add value if not exists 'alaga';
alter type public.vendor_category add value if not exists 'rentals';
alter type public.vendor_category add value if not exists 'transport';
alter type public.vendor_category add value if not exists 'small_chops';
alter type public.vendor_category add value if not exists 'bar_service';
alter type public.vendor_category add value if not exists 'dessert_table';
alter type public.vendor_category add value if not exists 'florist';
alter type public.vendor_category add value if not exists 'lighting_av';
alter type public.vendor_category add value if not exists 'stationery';
alter type public.vendor_category add value if not exists 'fireworks';
alter type public.vendor_category add value if not exists 'videographer';
alter type public.vendor_category add value if not exists 'photo_booth';
alter type public.vendor_category add value if not exists 'hair_stylist';
alter type public.vendor_category add value if not exists 'bridal_wear';
alter type public.vendor_category add value if not exists 'groom_attire';
alter type public.vendor_category add value if not exists 'gele';
alter type public.vendor_category add value if not exists 'jewellery';
alter type public.vendor_category add value if not exists 'kids_entertainment';
