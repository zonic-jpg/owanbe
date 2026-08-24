
-- ============ app_settings singleton ============
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  published_mode text NOT NULL DEFAULT 'live' CHECK (published_mode IN ('mock','live')),
  preview_mode text NOT NULL DEFAULT 'live' CHECK (preview_mode IN ('mock','live')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.app_settings (id) VALUES (true);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_public_read ON public.app_settings FOR SELECT USING (true);
CREATE POLICY settings_admin_update ON public.app_settings FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ helper functions ============
CREATE OR REPLACE FUNCTION public.current_published_mode() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT published_mode FROM public.app_settings WHERE id = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.row_visible(_origin text, _retain boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.current_published_mode() = 'mock' THEN true
    ELSE coalesce(_origin,'live') = 'live' OR coalesce(_retain,false) = true
  END;
$$;

-- ============ add origin/retain to content tables ============
ALTER TABLE public.catalog_products      ADD COLUMN origin text NOT NULL DEFAULT 'live', ADD COLUMN retain boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendors               ADD COLUMN origin text NOT NULL DEFAULT 'live', ADD COLUMN retain boolean NOT NULL DEFAULT false;
ALTER TABLE public.vendor_portfolio      ADD COLUMN origin text NOT NULL DEFAULT 'live', ADD COLUMN retain boolean NOT NULL DEFAULT false;
ALTER TABLE public.sponsors              ADD COLUMN origin text NOT NULL DEFAULT 'live', ADD COLUMN retain boolean NOT NULL DEFAULT false;
ALTER TABLE public.cities                ADD COLUMN origin text NOT NULL DEFAULT 'live', ADD COLUMN retain boolean NOT NULL DEFAULT false;
ALTER TABLE public.service_price_config  ADD COLUMN origin text NOT NULL DEFAULT 'live', ADD COLUMN retain boolean NOT NULL DEFAULT false;

-- ============ replace public_read policies to honor mode ============
DROP POLICY IF EXISTS catalog_public_read ON public.catalog_products;
CREATE POLICY catalog_public_read ON public.catalog_products FOR SELECT
  USING ((is_active = true AND public.row_visible(origin, retain)) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS vendors_public_read ON public.vendors;
CREATE POLICY vendors_public_read ON public.vendors FOR SELECT
  USING ((is_approved = true AND public.row_visible(origin, retain)) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS portfolio_public_read ON public.vendor_portfolio;
CREATE POLICY portfolio_public_read ON public.vendor_portfolio FOR SELECT
  USING (
    (public.row_visible(origin, retain) AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_portfolio.vendor_id
        AND v.is_approved = true
        AND public.row_visible(v.origin, v.retain)
    )) OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS sponsors_public_read ON public.sponsors;
CREATE POLICY sponsors_public_read ON public.sponsors FOR SELECT
  USING ((is_active = true AND public.row_visible(origin, retain)) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS cities_public_read ON public.cities;
CREATE POLICY cities_public_read ON public.cities FOR SELECT
  USING ((is_active = true AND public.row_visible(origin, retain)) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS spc_public_read ON public.service_price_config;
CREATE POLICY spc_public_read ON public.service_price_config FOR SELECT
  USING ((is_active = true AND public.row_visible(origin, retain)) OR public.is_admin(auth.uid()));

-- ============ landing_content (editable CMS) ============
CREATE TABLE public.landing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','html','json')),
  value text NOT NULL DEFAULT '',
  origin text NOT NULL DEFAULT 'live',
  retain boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.landing_content TO anon;
GRANT SELECT ON public.landing_content TO authenticated;
GRANT ALL ON public.landing_content TO service_role;

ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY lc_public_read ON public.landing_content FOR SELECT
  USING (public.row_visible(origin, retain) OR public.is_admin(auth.uid()));
CREATE POLICY lc_admin_all ON public.landing_content FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER landing_content_updated_at BEFORE UPDATE ON public.landing_content
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ admin actions ============
CREATE OR REPLACE FUNCTION public.set_preview_mode(_mode text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  IF _mode NOT IN ('mock','live') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
  UPDATE public.app_settings SET preview_mode = _mode, updated_at = now(), updated_by = auth.uid() WHERE id = true;
END; $$;

CREATE OR REPLACE FUNCTION public.approve_preview() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.app_settings SET published_mode = preview_mode, updated_at = now(), updated_by = auth.uid() WHERE id = true;
  INSERT INTO public.role_audit_log(actor_id, target_user_id, action, role)
    VALUES (auth.uid(), auth.uid(), 'approve_preview', 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.promote_retained_to_live() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0; t int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.catalog_products     SET origin='live' WHERE retain AND origin='mock'; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  UPDATE public.vendors              SET origin='live' WHERE retain AND origin='mock'; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  UPDATE public.vendor_portfolio     SET origin='live' WHERE retain AND origin='mock'; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  UPDATE public.sponsors             SET origin='live' WHERE retain AND origin='mock'; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  UPDATE public.cities               SET origin='live' WHERE retain AND origin='mock'; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  UPDATE public.service_price_config SET origin='live' WHERE retain AND origin='mock'; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  UPDATE public.landing_content      SET origin='live' WHERE retain AND origin='mock'; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.purge_mock_data() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0; t int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  DELETE FROM public.catalog_products     WHERE origin='mock' AND NOT retain; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  DELETE FROM public.vendor_portfolio     WHERE origin='mock' AND NOT retain; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  DELETE FROM public.vendors              WHERE origin='mock' AND NOT retain; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  DELETE FROM public.sponsors             WHERE origin='mock' AND NOT retain; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  DELETE FROM public.cities               WHERE origin='mock' AND NOT retain; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  DELETE FROM public.service_price_config WHERE origin='mock' AND NOT retain; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  DELETE FROM public.landing_content      WHERE origin='mock' AND NOT retain; GET DIAGNOSTICS t = ROW_COUNT; n := n+t;
  RETURN n;
END; $$;

-- ============ seed landing_content ============
INSERT INTO public.landing_content (key, kind, value, position) VALUES
('hero.eyebrow','text','The Owanbe Planner',10),
('hero.title.line1','text','Plan Your Owanbe.',20),
('hero.title.line2','text','Engage The Best.',30),
('hero.title.line3','text','Live It Out.',40),
('hero.subtitle','text','From venue to caterers, aso ebi to bands — design every detail of a Nigerian wedding, birthday or funeral.',50),
('hero.subtitle.bold','text','Vetted vendors. Top 3 picks per category. Live Naira totals as you choose.',60),
('hero.cta.primary','text','Create your event',70),
('hero.cta.secondary','text','Browse vendors',80),
('hero.image','image','/src/assets/hero-event-bg.jpg',90),
('card.venue.eyebrow','text','AI Visuals',100),
('card.venue.title','text','See your venue\nbefore you book it.',110),
('card.venue.body','text','Render decor in your colors. Test the vibe. Skip the regret.',120),
('card.venue.image','image','/src/assets/apple-venue.jpg',125),
('card.vendors.eyebrow','text','Vendors',130),
('card.vendors.title','text','Vetted.\nCurated.\nBooked.',140),
('card.vendors.image','image','/src/assets/apple-tablescape.jpg',145),
('card.budget.eyebrow','text','Smart Budgets',150),
('card.budget.title','text','Pick.\nCompare.\nTotal.',160),
('card.budget.body','text','Browse the top 3 vetted options in every category — venues, caterers, DJs, decor and more. Compare prices side-by-side and watch your full Naira total update live as you build the perfect day, all without breaking your budget.',170),
('card.family.eyebrow','text','Family Mode',180),
('card.family.title','text','Auntie\napproved.',190),
('card.family.body','text','Invite the whole family to share, vote and comment on every choice — bring everyone in without the endless WhatsApp chaos.',200),
('card.joy.eyebrow','text','The day',210),
('card.joy.title','text','Pure joy,\non schedule.',220),
('card.joy.image','image','/src/assets/apple-dance.jpg',225),
('cta.final.line1','text','Your celebration.',300),
('cta.final.line2','text','Bigger than ever.',310),
('cta.final.body','text','Built in Nigeria, for the way we celebrate.',320),
('cta.final.button','text','Plan my Owanbe',330),
('footer.tagline','text','Owanbe Planner · Made in Nigeria',400)
ON CONFLICT (key) DO NOTHING;
