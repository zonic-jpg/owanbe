-- ============================================================
-- 1. Extend roles enum
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid
                 where t.typname='app_role' and e.enumlabel='brand') then
    alter type public.app_role add value 'brand';
  end if;
end$$;

-- ============================================================
-- 2. Enums
-- ============================================================
do $$ begin
  create type public.brand_status as enum ('draft','awaiting_payment','awaiting_approval','approved','rejected','suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_plan as enum ('monthly','annual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active','past_due','canceled','waived','pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('succeeded','pending','failed','waived','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.waiver_match_type as enum ('name','email','code');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admin_perm as enum ('view_financials','grant_waivers');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.vendor_event_type as enum ('view','shortlist_add','contact_whatsapp','contact_email','contact_phone');
exception when duplicate_object then null; end $$;

-- ============================================================
-- 3. Tables
-- ============================================================
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
create index if not exists brands_owner_idx on public.brands(owner_id);
create index if not exists brands_status_idx on public.brands(status);
create unique index if not exists brands_owner_unique on public.brands(owner_id);

create table if not exists public.brand_vendors (
  brand_id uuid not null references public.brands(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, vendor_id)
);
create index if not exists brand_vendors_vendor_idx on public.brand_vendors(vendor_id);

create table if not exists public.brand_waivers (
  id uuid primary key default gen_random_uuid(),
  match_type public.waiver_match_type not null,
  match_value text not null,
  code text unique,
  notes text,
  granted_by uuid not null,
  used_by_brand uuid references public.brands(id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists waivers_match_idx on public.brand_waivers(match_type, lower(match_value)) where is_active;

create table if not exists public.brand_subscriptions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  plan public.subscription_plan not null,
  status public.subscription_status not null default 'pending',
  amount bigint not null,
  currency text not null default 'NGN',
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  is_waived boolean not null default false,
  waiver_id uuid references public.brand_waivers(id) on delete set null,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subs_brand_idx on public.brand_subscriptions(brand_id);
create index if not exists subs_status_idx on public.brand_subscriptions(status);
create index if not exists subs_period_idx on public.brand_subscriptions(period_start, period_end);

create table if not exists public.brand_payments (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  subscription_id uuid references public.brand_subscriptions(id) on delete set null,
  amount bigint not null,
  currency text not null default 'NGN',
  status public.payment_status not null default 'pending',
  method text not null default 'mock',
  external_ref text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_brand_idx on public.brand_payments(brand_id);
create index if not exists payments_paid_at_idx on public.brand_payments(paid_at);
create index if not exists payments_status_idx on public.brand_payments(status);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  perm public.admin_perm not null,
  granted_by uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, perm)
);
create index if not exists admin_perm_user_idx on public.admin_permissions(user_id);

create table if not exists public.vendor_analytics_events (
  id bigserial primary key,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  event_type public.vendor_event_type not null,
  user_id uuid,
  session_id text,
  created_at timestamptz not null default now()
);
create index if not exists va_events_vendor_idx on public.vendor_analytics_events(vendor_id, created_at desc);
create index if not exists va_events_type_idx on public.vendor_analytics_events(event_type, created_at desc);

-- ============================================================
-- 4. updated_at triggers
-- ============================================================
drop trigger if exists trg_brands_updated on public.brands;
create trigger trg_brands_updated before update on public.brands
  for each row execute function public.set_updated_at();

drop trigger if exists trg_subs_updated on public.brand_subscriptions;
create trigger trg_subs_updated before update on public.brand_subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. Permission helpers
-- ============================================================
create or replace function public.has_admin_permission(_user uuid, _perm public.admin_perm)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_role(_user, 'super_admin')
    or exists (
      select 1 from public.admin_permissions
      where user_id = _user and perm = _perm
        and public.is_admin(_user)
    );
$$;

create or replace function public.grant_admin_permission(_target uuid, _perm public.admin_perm)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only super admins can grant permissions';
  end if;
  insert into public.admin_permissions (user_id, perm, granted_by)
    values (_target, _perm, auth.uid())
    on conflict (user_id, perm) do nothing;
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), _target, 'grant_perm:' || _perm::text, 'admin');
end; $$;

create or replace function public.revoke_admin_permission(_target uuid, _perm public.admin_perm)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only super admins can revoke permissions';
  end if;
  delete from public.admin_permissions where user_id = _target and perm = _perm;
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), _target, 'revoke_perm:' || _perm::text, 'admin');
end; $$;

-- ============================================================
-- 6. Brand workflow RPCs
-- ============================================================
create or replace function public.request_brand_approval(_brand uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.brands%rowtype;
begin
  select * into b from public.brands where id = _brand;
  if not found then raise exception 'Brand not found'; end if;
  if b.owner_id <> auth.uid() then raise exception 'Not your brand'; end if;
  if b.status not in ('draft','rejected','awaiting_payment') then
    raise exception 'Cannot submit from current status';
  end if;
  -- Must have an active or waived subscription
  if not exists (
    select 1 from public.brand_subscriptions s
    where s.brand_id = _brand and s.status in ('active','waived') and s.period_end > now()
  ) then
    raise exception 'No active subscription or waiver';
  end if;
  update public.brands
    set status = 'awaiting_approval', submitted_at = now()
    where id = _brand;
end; $$;

create or replace function public.approve_brand(_brand uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Admin only'; end if;
  update public.brands
    set status='approved', approved_at=now(), approved_by=auth.uid(), rejection_reason=null
    where id=_brand;
  insert into public.role_audit_log(actor_id, target_user_id, action, role)
  select auth.uid(), owner_id, 'brand_approved', 'brand' from public.brands where id=_brand;
end; $$;

create or replace function public.reject_brand(_brand uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(auth.uid()) then raise exception 'Admin only'; end if;
  update public.brands
    set status='rejected', rejection_reason=_reason
    where id=_brand;
  insert into public.role_audit_log(actor_id, target_user_id, action, role)
  select auth.uid(), owner_id, 'brand_rejected', 'brand' from public.brands where id=_brand;
end; $$;

-- Apply waiver for a brand (called after brand row is created)
create or replace function public.apply_waiver_to_brand(_brand uuid, _code text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  b public.brands%rowtype;
  w public.brand_waivers%rowtype;
begin
  select * into b from public.brands where id = _brand;
  if not found or b.owner_id <> auth.uid() then raise exception 'Not your brand'; end if;

  -- Try code first (most specific)
  if _code is not null and length(_code) > 0 then
    select * into w from public.brand_waivers
      where is_active and match_type='code' and code = _code
        and (expires_at is null or expires_at > now())
        and used_by_brand is null
      limit 1;
  end if;

  -- Then email
  if not found then
    select * into w from public.brand_waivers
      where is_active and match_type='email'
        and lower(match_value) = lower(b.contact_email)
        and (expires_at is null or expires_at > now())
        and (used_by_brand is null or used_by_brand = b.id)
      limit 1;
  end if;

  -- Then name
  if not found then
    select * into w from public.brand_waivers
      where is_active and match_type='name'
        and lower(match_value) = lower(b.name)
        and (expires_at is null or expires_at > now())
        and (used_by_brand is null or used_by_brand = b.id)
      limit 1;
  end if;

  if not found then return false; end if;

  -- Mark waiver used
  update public.brand_waivers
    set used_by_brand = b.id, used_at = now(),
        is_active = case when match_type='code' then false else is_active end
    where id = w.id;

  -- Create a waived subscription valid 1 year
  insert into public.brand_subscriptions(brand_id, plan, status, amount, period_start, period_end, is_waived, waiver_id)
    values (b.id, 'annual', 'waived', 0, now(), now() + interval '1 year', true, w.id);

  return true;
end; $$;

-- Public event tracking
create or replace function public.record_vendor_event(_vendor uuid, _type public.vendor_event_type, _session text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.vendor_analytics_events(vendor_id, event_type, user_id, session_id)
    values (_vendor, _type, auth.uid(), _session);
end; $$;

-- Financial summary (gated)
create or replace function public.brand_financial_summary()
returns table (
  month_start date,
  monthly_revenue bigint,
  payment_count integer,
  active_subs integer,
  waived_subs integer
) language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission(auth.uid(), 'view_financials') then
    raise exception 'Permission denied';
  end if;
  return query
  select date_trunc('month', p.paid_at)::date as month_start,
         coalesce(sum(p.amount),0)::bigint as monthly_revenue,
         count(*)::int as payment_count,
         (select count(*)::int from public.brand_subscriptions where status='active' and period_end > now()) as active_subs,
         (select count(*)::int from public.brand_subscriptions where status='waived' and period_end > now()) as waived_subs
  from public.brand_payments p
  where p.status = 'succeeded' and p.paid_at is not null
  group by 1
  order by 1 desc;
end; $$;

-- ============================================================
-- 7. RLS
-- ============================================================
alter table public.brands enable row level security;
alter table public.brand_vendors enable row level security;
alter table public.brand_subscriptions enable row level security;
alter table public.brand_payments enable row level security;
alter table public.brand_waivers enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.vendor_analytics_events enable row level security;

-- brands
drop policy if exists brands_owner_select on public.brands;
create policy brands_owner_select on public.brands for select
  using (auth.uid() = owner_id or public.is_admin(auth.uid()));

drop policy if exists brands_owner_insert on public.brands;
create policy brands_owner_insert on public.brands for insert
  with check (auth.uid() = owner_id);

drop policy if exists brands_owner_update on public.brands;
create policy brands_owner_update on public.brands for update
  using (
    (auth.uid() = owner_id and status in ('draft','awaiting_payment','rejected'))
    or public.is_admin(auth.uid())
  )
  with check (
    (auth.uid() = owner_id) or public.is_admin(auth.uid())
  );

drop policy if exists brands_admin_delete on public.brands;
create policy brands_admin_delete on public.brands for delete
  using (public.is_admin(auth.uid()));

-- brand_vendors
drop policy if exists bv_owner_all on public.brand_vendors;
create policy bv_owner_all on public.brand_vendors for all
  using (
    exists (select 1 from public.brands b where b.id = brand_id and (b.owner_id = auth.uid() or public.is_admin(auth.uid())))
  )
  with check (
    exists (select 1 from public.brands b where b.id = brand_id and (b.owner_id = auth.uid() or public.is_admin(auth.uid())))
  );

-- subscriptions
drop policy if exists subs_owner_select on public.brand_subscriptions;
create policy subs_owner_select on public.brand_subscriptions for select
  using (
    exists (select 1 from public.brands b where b.id = brand_id and b.owner_id = auth.uid())
    or public.has_admin_permission(auth.uid(), 'view_financials')
  );

drop policy if exists subs_owner_insert on public.brand_subscriptions;
create policy subs_owner_insert on public.brand_subscriptions for insert
  with check (
    exists (select 1 from public.brands b where b.id = brand_id and b.owner_id = auth.uid())
    or public.is_admin(auth.uid())
  );

drop policy if exists subs_admin_update on public.brand_subscriptions;
create policy subs_admin_update on public.brand_subscriptions for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- payments
drop policy if exists pay_owner_select on public.brand_payments;
create policy pay_owner_select on public.brand_payments for select
  using (
    exists (select 1 from public.brands b where b.id = brand_id and b.owner_id = auth.uid())
    or public.has_admin_permission(auth.uid(), 'view_financials')
  );

drop policy if exists pay_owner_insert on public.brand_payments;
create policy pay_owner_insert on public.brand_payments for insert
  with check (
    exists (select 1 from public.brands b where b.id = brand_id and b.owner_id = auth.uid())
    or public.is_admin(auth.uid())
  );

-- waivers
drop policy if exists waivers_admin_select on public.brand_waivers;
create policy waivers_admin_select on public.brand_waivers for select
  using (public.is_admin(auth.uid()));

drop policy if exists waivers_admin_insert on public.brand_waivers;
create policy waivers_admin_insert on public.brand_waivers for insert
  with check (
    public.has_role(auth.uid(),'super_admin')
    or public.has_admin_permission(auth.uid(),'grant_waivers')
  );

drop policy if exists waivers_admin_update on public.brand_waivers;
create policy waivers_admin_update on public.brand_waivers for update
  using (
    public.has_role(auth.uid(),'super_admin')
    or public.has_admin_permission(auth.uid(),'grant_waivers')
  );

-- admin_permissions
drop policy if exists ap_super_all on public.admin_permissions;
create policy ap_super_all on public.admin_permissions for all
  using (public.has_role(auth.uid(),'super_admin'))
  with check (public.has_role(auth.uid(),'super_admin'));

drop policy if exists ap_self_select on public.admin_permissions;
create policy ap_self_select on public.admin_permissions for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- vendor analytics events: public insert (anonymous tracking), restricted read
drop policy if exists va_public_insert on public.vendor_analytics_events;
create policy va_public_insert on public.vendor_analytics_events for insert with check (true);

drop policy if exists va_brand_or_admin_read on public.vendor_analytics_events;
create policy va_brand_or_admin_read on public.vendor_analytics_events for select
  using (
    public.has_admin_permission(auth.uid(), 'view_financials')
    or exists (
      select 1
      from public.brand_vendors bv
      join public.brands b on b.id = bv.brand_id
      where bv.vendor_id = vendor_analytics_events.vendor_id
        and b.owner_id = auth.uid()
    )
  );