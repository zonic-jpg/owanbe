
CREATE TABLE public.cities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  state text,
  population integer NOT NULL DEFAULT 0,
  social_tags text[] NOT NULL DEFAULT '{}',
  notes text,
  rank integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, state)
);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY cities_public_read ON public.cities
  FOR SELECT USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY cities_admin_all ON public.cities
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER cities_set_updated_at
  BEFORE UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_cities_population ON public.cities (population DESC);
CREATE INDEX idx_cities_name ON public.cities (lower(name));
