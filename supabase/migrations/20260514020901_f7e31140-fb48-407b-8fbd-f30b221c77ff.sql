
-- Catalog products table
CREATE TABLE public.catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  category vendor_category NOT NULL,
  name text NOT NULL,
  description text,
  unit_label text NOT NULL DEFAULT 'flat',
  unit_price bigint NOT NULL DEFAULT 0,
  image_url text,
  rating numeric NOT NULL DEFAULT 4.6,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  city text NOT NULL DEFAULT 'Lagos',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_products_cat_city ON public.catalog_products(category, city) WHERE is_active = true;
CREATE INDEX idx_catalog_products_vendor ON public.catalog_products(vendor_id);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_public_read ON public.catalog_products FOR SELECT USING (is_active = true OR is_admin(auth.uid()));
CREATE POLICY catalog_admin_all ON public.catalog_products FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER trg_catalog_products_updated BEFORE UPDATE ON public.catalog_products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Event selections (one product per category per event)
CREATE TABLE public.event_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category vendor_category NOT NULL,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 1,
  locked_unit_price bigint NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, category)
);
CREATE INDEX idx_selections_event ON public.event_selections(event_id);
CREATE INDEX idx_selections_product ON public.event_selections(product_id);

ALTER TABLE public.event_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel_owner_all ON public.event_selections FOR ALL
USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_selections.event_id AND e.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_selections.event_id AND e.owner_id = auth.uid()));
CREATE POLICY sel_admin_read ON public.event_selections FOR SELECT USING (is_admin(auth.uid()));

CREATE TRIGGER trg_selections_updated BEFORE UPDATE ON public.event_selections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Product analytics events
CREATE TYPE product_event_type AS ENUM ('view','click','shortlist','select');

CREATE TABLE public.product_analytics_events (
  id bigserial PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  event_type product_event_type NOT NULL,
  user_id uuid,
  session_id text,
  event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pae_product_type ON public.product_analytics_events(product_id, event_type, created_at DESC);

ALTER TABLE public.product_analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pae_public_insert ON public.product_analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY pae_brand_or_admin_read ON public.product_analytics_events FOR SELECT USING (
  has_admin_permission(auth.uid(), 'view_financials')
  OR EXISTS (
    SELECT 1 FROM public.catalog_products cp
    JOIN public.brand_vendors bv ON bv.vendor_id = cp.vendor_id
    JOIN public.brands b ON b.id = bv.brand_id
    WHERE cp.id = product_analytics_events.product_id AND b.owner_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.record_product_event(_product uuid, _type product_event_type, _session text DEFAULT NULL, _event uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.product_analytics_events(product_id, event_type, user_id, session_id, event_id)
  VALUES (_product, _type, auth.uid(), _session, _event);
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_product_event(uuid, product_event_type, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.record_product_event(uuid, product_event_type, text, uuid) TO anon, authenticated;

-- AI summaries cache
CREATE TABLE public.ai_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL, -- 'event' | 'brand'
  ref_id uuid NOT NULL,
  summary text NOT NULL,
  suggestions jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, ref_id)
);
ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_event_owner_read ON public.ai_summaries FOR SELECT USING (
  (scope = 'event' AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = ai_summaries.ref_id AND e.owner_id = auth.uid()))
  OR (scope = 'brand' AND EXISTS (SELECT 1 FROM public.brands b WHERE b.id = ai_summaries.ref_id AND b.owner_id = auth.uid()))
  OR is_admin(auth.uid())
);

-- Benchmark view: total spend per event by city/guest band
CREATE OR REPLACE VIEW public.event_spend_summary AS
SELECT e.id AS event_id, e.city,
  CASE WHEN e.guest_count < 150 THEN 'small'
       WHEN e.guest_count < 350 THEN 'medium'
       WHEN e.guest_count < 700 THEN 'large'
       ELSE 'mega' END AS guest_band,
  COALESCE(SUM(s.qty * s.locked_unit_price), 0)::bigint AS total_spend,
  COUNT(s.id)::int AS picks
FROM public.events e
LEFT JOIN public.event_selections s ON s.event_id = e.id
GROUP BY e.id, e.city, e.guest_count;

-- Storage bucket for catalog images
INSERT INTO storage.buckets (id, name, public) VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY catalog_images_admin_write ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalog-images' AND is_admin(auth.uid()));
CREATE POLICY catalog_images_admin_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'catalog-images' AND is_admin(auth.uid()));
CREATE POLICY catalog_images_admin_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'catalog-images' AND is_admin(auth.uid()));
