
CREATE TABLE public.client_404_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url text NOT NULL,
  referrer text,
  kind text NOT NULL DEFAULT 'route',
  user_agent text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_404_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY c404_public_insert ON public.client_404_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY c404_admin_select ON public.client_404_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY c404_admin_delete ON public.client_404_logs
  FOR DELETE USING (public.is_admin(auth.uid()));

CREATE INDEX idx_c404_created_at ON public.client_404_logs (created_at DESC);
CREATE INDEX idx_c404_kind ON public.client_404_logs (kind);
