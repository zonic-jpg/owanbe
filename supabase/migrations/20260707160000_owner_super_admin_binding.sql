-- Owanbe Joy — admin/role model update
-- 1) Super admin is bound to oadeagbo@gmail.com (Google auth), NOT first-to-claim.
-- 2) Super admin can transfer the role and create/restrict other admins.
-- 3) TEMPORARY: every authenticated user acts as admin so testers can test now.
--    (A revert block at the bottom turns testing mode off for production.)
-- Idempotent and safe to run more than once. Apply AFTER the base schema.

-- ── 1. Bind super admin to the designated owner email ───────────────────────
create or replace function public.is_super_admin_email(_email text)
returns boolean language sql immutable as $$
  select lower(coalesce(_email, '')) = 'oadeagbo@gmail.com';
$$;

-- claim_super_admin() now ONLY works for the owner email (no first-to-claim race).
create or replace function public.claim_super_admin()
returns void language plpgsql security definer set search_path = public, auth as $$
declare _email text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select email into _email from auth.users where id = auth.uid();
  if not public.is_super_admin_email(_email) then
    raise exception 'Only the designated owner (oadeagbo@gmail.com) can hold super admin';
  end if;
  insert into public.user_roles (user_id, role, granted_by)
    values (auth.uid(), 'super_admin', auth.uid()) on conflict do nothing;
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), auth.uid(), 'bootstrap', 'super_admin');
end; $$;

-- Bootstrap: when the owner signs up / their email is set, grant super_admin
-- (only if no super_admin exists yet, so a deliberate transfer is not undone).
create or replace function public.grant_owner_super_admin()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if public.is_super_admin_email(new.email)
     and not exists (select 1 from public.user_roles where role = 'super_admin') then
    insert into public.user_roles (user_id, role, granted_by)
      values (new.id, 'super_admin', new.id) on conflict do nothing;
    insert into public.role_audit_log (actor_id, target_user_id, action, role)
      values (new.id, new.id, 'bootstrap', 'super_admin');
  end if;
  return new;
end; $$;

drop trigger if exists trg_owner_super_admin on auth.users;
create trigger trg_owner_super_admin
  after insert or update of email on auth.users
  for each row execute function public.grant_owner_super_admin();

-- Seed immediately if the owner has already signed up:
insert into public.user_roles (user_id, role, granted_by)
select u.id, 'super_admin', u.id
from auth.users u
where public.is_super_admin_email(u.email)
  and not exists (select 1 from public.user_roles where role = 'super_admin')
on conflict do nothing;

-- ── 2. Transfer super admin (owner/super_admin only) ────────────────────────
-- (grant_role / revoke_role already let the super admin create and restrict admins.)
create or replace function public.transfer_super_admin(_target uuid)
returns void language plpgsql security definer set search_path = public as $$
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
end; $$;

-- ── 3. TEMPORARY testing mode: every authenticated user acts as admin ───────
-- Grant admin to everyone who already signed up:
insert into public.user_roles (user_id, role)
select u.id, 'admin'::app_role from auth.users u
on conflict (user_id, role) do nothing;

-- And to every new signup while testing (separate trigger so it is easy to drop):
create or replace function public.grant_tester_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  return new;
end; $$;

drop trigger if exists trg_tester_admin on auth.users;
create trigger trg_tester_admin
  after insert on auth.users
  for each row execute function public.grant_tester_admin();

-- ============================================================================
-- REVERT TESTING MODE FOR PRODUCTION (run this block when testing is finished)
-- ----------------------------------------------------------------------------
-- drop trigger if exists trg_tester_admin on auth.users;
-- drop function if exists public.grant_tester_admin();
-- -- Remove the blanket 'admin' grants, but KEEP the owner and any real admins.
-- -- Replace the id list with the user_ids that should remain admins:
-- delete from public.user_roles
-- where role = 'admin'
--   and user_id not in (
--     select id from auth.users where public.is_super_admin_email(email)
--     -- , '<real-admin-user-id>', ...
--   );
-- ============================================================================
