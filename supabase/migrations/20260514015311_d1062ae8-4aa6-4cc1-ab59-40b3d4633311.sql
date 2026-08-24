-- 1. Fix set_updated_at search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 2. Revoke execute from anon/authenticated on internal helpers (used only by RLS/triggers)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_admin_permission(uuid, admin_perm) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

-- 3. Revoke execute from anon on admin/owner RPCs (keep authenticated, since the function checks auth internally)
REVOKE EXECUTE ON FUNCTION public.claim_super_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.grant_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.grant_admin_permission(uuid, admin_perm) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_admin_permission(uuid, admin_perm) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_brand(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_brand(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.request_brand_approval(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_waiver_to_brand(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.brand_financial_summary() FROM anon, public;

-- 4. record_vendor_event stays callable by anon (public click tracking)
-- handled implicitly: do nothing.

-- 5. Restrict listing on the vendor-covers bucket — files are still readable by URL via CDN.
DROP POLICY IF EXISTS "Public list vendor covers" ON storage.objects;
DROP POLICY IF EXISTS "vendor_covers_public_list" ON storage.objects;
DROP POLICY IF EXISTS "vendor-covers public read" ON storage.objects;