-- Critical RLS gap: profiles, user_roles, admin_permissions, role_audit_log
-- all had "enable row level security" in the original migration history, but
-- the live project's actual tracked migration history only starts at
-- 2026-09-03 (admin_access_requests onward) — the base schema chain
-- (20260428 through 20260730) was never applied through Supabase migrations
-- here, so RLS never actually got enabled on the live tables. Confirmed via
-- get_advisors: RLS Disabled in Public (ERROR) on all 4. With RLS disabled,
-- anon could read every user's profile and, worse, insert/update
-- user_roles/admin_permissions directly — a full privilege-escalation path
-- to super_admin with no auth required at all.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.role_audit_log enable row level security;

-- profiles: own row read/update; admins can read all.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- user_roles: users can see their own role rows; only admins can see/manage
-- everyone else's. Actual grants go through the SECURITY DEFINER RPCs
-- (grant_reviewer_admin, grant_owner_super_admin, claim_super_admin), which
-- run as the function owner and so are unaffected by this RLS tightening.
drop policy if exists "user_roles_select_own_or_admin" on public.user_roles;
create policy "user_roles_select_own_or_admin" on public.user_roles
  for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "user_roles_admin_write" on public.user_roles;
create policy "user_roles_admin_write" on public.user_roles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- admin_permissions: admin-only in both directions.
drop policy if exists "admin_permissions_admin_all" on public.admin_permissions;
create policy "admin_permissions_admin_all" on public.admin_permissions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- role_audit_log: admin-only read; writes happen via SECURITY DEFINER grant
-- functions (which bypass RLS as the function owner), so no client insert
-- policy is needed.
drop policy if exists "role_audit_log_admin_read" on public.role_audit_log;
create policy "role_audit_log_admin_read" on public.role_audit_log
  for select using (public.is_admin(auth.uid()));

-- Also pin down the two RLS-enabled-but-policy-less tables the advisor
-- flagged (admin_access_requests, brands) so reads don't silently
-- deny-all forever.
drop policy if exists "admin_access_requests_admin_read" on public.admin_access_requests;
create policy "admin_access_requests_admin_read" on public.admin_access_requests
  for select using (public.is_admin(auth.uid()));

-- brands: public can see approved brands; owners see their own regardless of
-- status; admins see everything. Owners (or admins) can write.
drop policy if exists "brands_public_read_approved" on public.brands;
create policy "brands_public_read_approved" on public.brands
  for select using (
    status = 'approved'
    or owner_id = auth.uid()
    or public.is_admin(auth.uid())
  );

drop policy if exists "brands_owner_write" on public.brands;
create policy "brands_owner_write" on public.brands
  for all using (owner_id = auth.uid() or public.is_admin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_admin(auth.uid()));
