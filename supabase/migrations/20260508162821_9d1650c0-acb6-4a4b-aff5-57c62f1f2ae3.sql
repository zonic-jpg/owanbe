ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS cover_phash text,
  ADD COLUMN IF NOT EXISTS cover_subject_kind text,
  ADD COLUMN IF NOT EXISTS cover_subject_gender text;
CREATE INDEX IF NOT EXISTS vendors_category_phash_idx ON public.vendors(category) WHERE cover_phash IS NOT NULL;