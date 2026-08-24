-- APPLY_ALL.sql — paste into Supabase SQL Editor
-- For a fresh project: run all files in supabase/migrations/ in filename order first,
-- then run this file (or use: npx supabase db push).
-- Idempotent: safe to re-run.

-- Owanbe Planner (OwnablePlanner) — schema cache + access control fix
-- Safe to run after the base migration chain (idempotent).
--
-- Fixes:
-- 1) Ensures core tables exist as public.events / public.brands (app uses plural names).
-- 2) Founding owner (oadeagbo@gmail.com) always receives super_admin.
-- 3) Reviewers/testers receive admin + all admin permissions by default.
-- 4) Reloads PostgREST schema cache after DDL.

-- ── 1. Core enums (no-op if base migrations already ran) ───────────────────
do $$ begin create type public.app_role as enum ('user','admin','super_admin'); exception when duplicate_object then null; end $$;
do $$ begin create type public.event_type as enum ('wedding','birthday','burial','housewarming','chieftaincy','anniversary','naming','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.event_status as enum ('draft','planning','confirmed','completed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.tier_level as enum ('gold','platinum','diamond'); exception when duplicate_object then null; end $$;
do $$ begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid where t.typname='app_role' and e.enumlabel='brand') then
    alter type public.app_role add value 'brand';
  end if;
end $$;
do $$ begin create type public.brand_status as enum ('draft','awaiting_payment','awaiting_approval','approved','rejected','suspended'); exception when duplicate_object then null; end $$;
do $$ begin create type public.admin_perm as enum ('view_financials','grant_waivers'); exception when duplicate_object then null; end $$;

-- ── 2. Ensure profiles + role tables exist ─────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  perm public.admin_perm not null,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, perm)
);

create table if not exists public.role_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null,
  action text not null,
  role public.app_role not null,
  created_at timestamptz not null default now()
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','super_admin'));
$$;

-- ── 3. Ensure events + brands tables (plural — matches app code) ───────────
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Owanbe',
  type public.event_type not null default 'wedding',
  event_date date,
  city text not null default 'Lagos',
  guest_count int not null default 200,
  budget_min bigint not null default 1000000,
  budget_max bigint not null default 5000000,
  vibe text,
  colors text[],
  notes text,
  status public.event_status not null default 'draft',
  selected_tier public.tier_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  slug text unique,
  contact_email text not null,
  contact_phone text,
  website text,
  logo_url text,
  bio text,
  status public.brand_status not null default 'draft',
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_owner_idx on public.events(owner_id);
create index if not exists brands_owner_idx on public.brands(owner_id);
create unique index if not exists brands_owner_unique on public.brands(owner_id);

alter table public.events enable row level security;
alter table public.brands enable row level security;

do $$ begin
  create policy events_owner_all on public.events for all
    using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy events_admin_select on public.events for select
    using (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ── 4. Founding owner helpers ───────────────────────────────────────────────
create or replace function public.is_super_admin_email(_email text)
returns boolean language sql immutable as $$
  select lower(coalesce(_email, '')) = 'oadeagbo@gmail.com';
$$;

create or replace function public.grant_reviewer_admin(_uid uuid, _granted_by uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare gby uuid := coalesce(_granted_by, _uid);
begin
  insert into public.user_roles (user_id, role) values (_uid, 'user') on conflict do nothing;
  insert into public.user_roles (user_id, role) values (_uid, 'admin') on conflict do nothing;
  insert into public.admin_permissions (user_id, perm, granted_by)
    values (_uid, 'view_financials', gby) on conflict (user_id, perm) do nothing;
  insert into public.admin_permissions (user_id, perm, granted_by)
    values (_uid, 'grant_waivers', gby) on conflict (user_id, perm) do nothing;
end;
$$;

create or replace function public.grant_founding_owner_super_admin(_uid uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
declare _email text;
begin
  select email into _email from auth.users where id = _uid;
  if not public.is_super_admin_email(_email) then
    return;
  end if;
  perform public.grant_reviewer_admin(_uid, _uid);
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

-- Called from the app after sign-in (MyYanga / AdSpot pattern).
create or replace function public.ensure_session_access()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
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

  perform public.grant_reviewer_admin(uid, uid);

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

create or replace function public.claim_super_admin()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  perform public.grant_founding_owner_super_admin(auth.uid());
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only the designated owner (oadeagbo@gmail.com) can hold super admin';
  end if;
end;
$$;

create or replace function public.grant_owner_super_admin()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if public.is_super_admin_email(new.email) then
    perform public.grant_founding_owner_super_admin(new.id);
  else
    perform public.grant_reviewer_admin(new.id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_owner_super_admin on auth.users;
create trigger trg_owner_super_admin
  after insert or update of email on auth.users
  for each row execute function public.grant_owner_super_admin();

-- Replace legacy tester trigger (admin only) with reviewer admin + perms.
drop trigger if exists trg_tester_admin on auth.users;
drop function if exists public.grant_tester_admin();

-- Backfill existing accounts
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role from auth.users u
on conflict do nothing;

insert into public.admin_permissions (user_id, perm, granted_by)
select u.id, p.perm::public.admin_perm, u.id
from auth.users u
cross join (values ('view_financials'), ('grant_waivers')) as p(perm)
on conflict (user_id, perm) do nothing;

insert into public.user_roles (user_id, role, granted_by)
select u.id, 'super_admin', u.id
from auth.users u
where public.is_super_admin_email(u.email)
on conflict do nothing;

-- ── 5. RPC grants ───────────────────────────────────────────────────────────
grant execute on function public.ensure_session_access() to authenticated;
grant execute on function public.claim_super_admin() to authenticated;

-- ── 6. Refresh PostgREST schema cache ───────────────────────────────────────
notify pgrst, 'reload schema';
