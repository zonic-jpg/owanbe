-- ═══════════════════════════════════════════════════════════════════════════
-- SAFE FOUNDER/SUPER-ADMIN BOOTSTRAP — supersedes a live privilege-escalation
-- hole found in this project's history.
-- ---------------------------------------------------------------------------
-- What was found live (audited 2026-09-06):
--   20260707160000_owner_super_admin_binding.sql defines a SAFE
--   grant_owner_super_admin() (founder-only, once). But
--   20260730170000_schema_access_fix.sql later `create or replace`s that same
--   function with a DANGEROUS version:
--
--     if is_super_admin_email(new.email) then grant_founding_owner_super_admin(new.id);
--     else perform grant_reviewer_admin(new.id, new.id);  -- <-- the hole
--
--   Because it's wired to `trg_owner_super_admin AFTER INSERT OR UPDATE OF
--   email ON auth.users`, it fired on every signup — not just the founder.
--   Every new, non-founder signup was silently granted the 'admin' role plus
--   view_financials and grant_waivers permissions, no approval step, no audit
--   beyond the trigger itself. Confirmed live and ENABLED with zero existing
--   users (auth.users count = 0), so no account was actually compromised, but
--   the very next signup would have been.
--
--   20260730170000_schema_access_fix.sql also carries a one-time backfill
--   (`insert into user_roles select ... from auth.users`) that would have
--   made every ALREADY-EXISTING user an admin the moment it ran — same class
--   of bug, different trigger point. Do not replay that file's admin-grant
--   sections as-is; only its non-role-related pieces (if any) are safe.
--
--   `20260707160000`'s own "TEMPORARY testing mode" block (grant_tester_admin
--   / trg_tester_admin, blanket-granting 'admin' to every signup) was never
--   applied to this project. Leave it that way — do not run that block.
--
-- This migration is the fix: it removes the dangerous trigger/function for
-- good and puts the founder-only bootstrap the frontend actually calls
-- (AuthContext -> ensure_session_access(), with claim_super_admin() as a
-- manual fallback) on record as the one and only auto-grant path. Both are
-- self-gated to is_super_admin_email() = 'oadeagbo@gmail.com' — no email
-- other than the founder's can ever reach 'super_admin' or 'admin' through
-- these functions. Idempotent; safe to run on a project that never had the
-- dangerous trigger at all.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Remove the dangerous auto-admin-on-signup path ──────────────────────────
drop trigger if exists trg_owner_super_admin on auth.users;
drop trigger if exists trg_tester_admin on auth.users;
drop function if exists public.grant_owner_super_admin();
drop function if exists public.grant_tester_admin();

-- ── The one safe auto-grant path (founder email only) ───────────────────────
create or replace function public.is_super_admin_email(_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(coalesce(_email, '')) = 'oadeagbo@gmail.com';
$$;

create or replace function public.grant_founding_owner_super_admin(_uid uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare _email text;
begin
  select email into _email from auth.users where id = _uid;
  if not public.is_super_admin_email(_email) then
    return;
  end if;
  insert into public.user_roles (user_id, role) values (_uid, 'user') on conflict do nothing;
  insert into public.user_roles (user_id, role, granted_by)
    values (_uid, 'super_admin', _uid) on conflict do nothing;
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    select _uid, _uid, 'bootstrap', 'super_admin'
    where not exists (
      select 1 from public.role_audit_log
      where target_user_id = _uid and action = 'bootstrap' and role = 'super_admin'
    );
end;
$$;

-- Called from src/contexts/AuthContext.tsx on every session (non-blocking,
-- 8s timeout, never throws client-side — see src/lib/sessionAccess.ts).
create or replace function public.ensure_session_access()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  uemail text;
  is_founding boolean := false;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select email into uemail from auth.users where id = uid;
  is_founding := public.is_super_admin_email(uemail);

  insert into public.user_roles (user_id, role) values (uid, 'user') on conflict do nothing;

  if is_founding then
    perform public.grant_founding_owner_super_admin(uid);
  end if;

  return jsonb_build_object(
    'user_id', uid,
    'email', uemail,
    'is_founding_owner', is_founding,
    'is_super_admin', public.has_role(uid, 'super_admin'),
    'is_admin', public.is_admin(uid)
  );
end;
$$;

-- Manual fallback the founder's client can call directly.
create or replace function public.claim_super_admin()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.grant_founding_owner_super_admin(auth.uid());
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only the designated owner (oadeagbo@gmail.com) can hold super admin';
  end if;
end;
$$;

-- Lets the founder deliberately hand off the role later (from
-- 20260707160000's design intent) — gated to an existing super_admin only.
create or replace function public.transfer_super_admin(_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only the super admin can transfer the role';
  end if;
  if _target is null then raise exception 'Target user required'; end if;
  insert into public.user_roles (user_id, role, granted_by)
    values (_target, 'super_admin', auth.uid()) on conflict do nothing;
  delete from public.user_roles where user_id = auth.uid() and role = 'super_admin';
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), _target, 'transfer', 'super_admin');
end;
$$;

grant execute on function public.ensure_session_access() to authenticated;
grant execute on function public.claim_super_admin() to authenticated;
grant execute on function public.grant_founding_owner_super_admin(uuid) to authenticated;
grant execute on function public.transfer_super_admin(uuid) to authenticated;

-- One-time immediate grant if the founder has already signed up.
insert into public.user_roles (user_id, role)
select u.id, 'user' from auth.users u
where public.is_super_admin_email(u.email)
on conflict do nothing;
insert into public.user_roles (user_id, role, granted_by)
select u.id, 'super_admin', u.id from auth.users u
where public.is_super_admin_email(u.email)
on conflict do nothing;

-- ── Function search_path hardening (advisor: function_search_path_mutable) ──
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

notify pgrst, 'reload schema';
