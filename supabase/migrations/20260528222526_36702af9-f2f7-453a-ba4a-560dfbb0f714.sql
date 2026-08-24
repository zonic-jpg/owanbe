-- Demo login control + auto-elevation
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS demo_login_enabled boolean NOT NULL DEFAULT true;

-- Grants the calling user the 'admin' role IF and only if:
--   * they are signed in as the demo account (email = test@demo.local), and
--   * the admin-controlled demo_login_enabled flag is true.
-- Idempotent — safe to call on every demo sign-in.
CREATE OR REPLACE FUNCTION public.ensure_demo_access()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _enabled boolean;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  SELECT demo_login_enabled INTO _enabled FROM public.app_settings WHERE id = true;
  IF NOT coalesce(_enabled, false) THEN RETURN false; END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;
  IF lower(coalesce(_email,'')) <> 'test@demo.local' THEN RETURN false; END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (_uid, 'admin', _uid)
    ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

-- Admin-only toggle for the flag (mirrors set_preview_mode shape).
CREATE OR REPLACE FUNCTION public.set_demo_login_enabled(_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.app_settings
     SET demo_login_enabled = _enabled, updated_at = now(), updated_by = auth.uid()
   WHERE id = true;
END;
$$;