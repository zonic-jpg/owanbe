-- Track per-vendor cover generation status for retries and resumption
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS cover_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cover_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_last_error text,
  ADD COLUMN IF NOT EXISTS cover_generated_at timestamptz;

-- Mark vendors that already have a real storage URL as done
UPDATE public.vendors
SET cover_status = 'done'
WHERE cover_url ILIKE '%/storage/v1/object/public/vendor-covers/vendor/%'
  AND cover_status <> 'done';

CREATE INDEX IF NOT EXISTS vendors_cover_status_idx
  ON public.vendors (cover_status, cover_attempts);

-- Job runs table for progress tracking
CREATE TABLE IF NOT EXISTS public.cover_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running', -- running | completed | failed
  batch_size int NOT NULL DEFAULT 50,
  processed int NOT NULL DEFAULT 0,
  succeeded int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message text
);

ALTER TABLE public.cover_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cover_jobs_admin_all"
ON public.cover_jobs
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS cover_jobs_started_idx
  ON public.cover_jobs (started_at DESC);