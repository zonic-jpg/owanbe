ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS cover_style_variant smallint;

CREATE INDEX IF NOT EXISTS vendors_category_cover_style_idx
  ON public.vendors (category, cover_generated_at DESC)
  WHERE cover_style_variant IS NOT NULL;