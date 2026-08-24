
-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum ('user', 'admin', 'super_admin');
create type public.event_type as enum ('wedding','birthday','burial','housewarming','chieftaincy','anniversary','naming','other');
create type public.event_status as enum ('draft','planning','confirmed','completed');
create type public.tier_level as enum ('gold','platinum','diamond');
create type public.vendor_category as enum ('decor','catering','photography','dj','mc','makeup','aso_ebi','cake','venue','drinks','security','logistics','souvenirs');
create type public.price_band as enum ('affordable','mid','premium','luxury');
create type public.collab_access as enum ('view','comment');

-- =========================================================
-- HELPER: updated_at trigger
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create trigger profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end; $$;

-- =========================================================
-- USER ROLES + AUDIT
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create table public.role_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_user_id uuid not null,
  action text not null, -- 'grant' | 'revoke' | 'bootstrap'
  role app_role not null,
  created_at timestamptz not null default now()
);
alter table public.role_audit_log enable row level security;

-- Security definer role check (no recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','super_admin'));
$$;

-- Policies: users can see their own roles; admins+super can see all
create policy "roles_select_own" on public.user_roles for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
-- Only super_admin can directly insert/delete (via RPC normally)
create policy "roles_super_manage" on public.user_roles for all using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));

create policy "audit_select_admin" on public.role_audit_log for select using (public.is_admin(auth.uid()));

-- Trigger: on new auth user create profile + default role
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Bootstrap: first user can claim super_admin once
create or replace function public.claim_super_admin()
returns void language plpgsql security definer set search_path = public as $$
declare
  super_count int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select count(*) into super_count from public.user_roles where role = 'super_admin';
  if super_count > 0 then raise exception 'Super admin already exists'; end if;
  insert into public.user_roles (user_id, role, granted_by) values (auth.uid(), 'super_admin', auth.uid())
    on conflict do nothing;
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), auth.uid(), 'bootstrap', 'super_admin');
end; $$;

-- Grant/Revoke admin (super_admin only)
create or replace function public.grant_role(_target uuid, _role app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only super admins can grant roles';
  end if;
  insert into public.user_roles (user_id, role, granted_by) values (_target, _role, auth.uid())
    on conflict do nothing;
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), _target, 'grant', _role);
end; $$;

create or replace function public.revoke_role(_target uuid, _role app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'super_admin') then
    raise exception 'Only super admins can revoke roles';
  end if;
  if _role = 'super_admin' and _target = auth.uid() then
    raise exception 'Cannot revoke your own super admin role';
  end if;
  delete from public.user_roles where user_id = _target and role = _role;
  insert into public.role_audit_log (actor_id, target_user_id, action, role)
    values (auth.uid(), _target, 'revoke', _role);
end; $$;

-- =========================================================
-- EVENTS / TIERS / BUDGET
-- =========================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Owanbe',
  type event_type not null default 'wedding',
  event_date date,
  city text not null default 'Lagos',
  guest_count int not null default 200,
  budget_min bigint not null default 1000000,
  budget_max bigint not null default 5000000,
  vibe text,
  colors text[],
  notes text,
  status event_status not null default 'draft',
  selected_tier tier_level,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.events enable row level security;
create trigger events_updated before update on public.events for each row execute function public.set_updated_at();

create policy "events_owner_all" on public.events for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "events_admin_select" on public.events for select using (public.is_admin(auth.uid()));

create table public.tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  level tier_level not null,
  total_estimate bigint not null default 0,
  summary text,
  created_at timestamptz not null default now(),
  unique(event_id, level)
);
alter table public.tiers enable row level security;
create policy "tiers_via_event" on public.tiers for all
  using (exists (select 1 from public.events e where e.id = tiers.event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = tiers.event_id and e.owner_id = auth.uid()));
create policy "tiers_admin_select" on public.tiers for select using (public.is_admin(auth.uid()));

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.tiers(id) on delete cascade,
  category vendor_category not null,
  name text not null,
  description text,
  qty int not null default 1,
  unit_price bigint not null default 0,
  position int not null default 0,
  vendor_id uuid,
  created_at timestamptz not null default now()
);
alter table public.budget_items enable row level security;
create policy "items_via_tier" on public.budget_items for all
  using (exists (
    select 1 from public.tiers t join public.events e on e.id = t.event_id
    where t.id = budget_items.tier_id and e.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.tiers t join public.events e on e.id = t.event_id
    where t.id = budget_items.tier_id and e.owner_id = auth.uid()
  ));

-- =========================================================
-- SERVICE PRICE CONFIG (admin tunable)
-- =========================================================
create table public.service_price_config (
  id uuid primary key default gen_random_uuid(),
  service vendor_category not null,
  city text not null,
  tier_level tier_level not null,
  base_price_per_guest bigint not null default 0,
  base_flat_price bigint not null default 0,
  notes text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(service, city, tier_level)
);
alter table public.service_price_config enable row level security;
create trigger spc_updated before update on public.service_price_config for each row execute function public.set_updated_at();
create policy "spc_public_read" on public.service_price_config for select using (is_active = true);
create policy "spc_admin_all" on public.service_price_config for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =========================================================
-- VENUE RENDERINGS
-- =========================================================
create table public.venue_renderings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null, -- 'empty' | 'decorated'
  prompt text,
  image_url text not null,
  created_at timestamptz not null default now()
);
alter table public.venue_renderings enable row level security;
create policy "renders_via_event" on public.venue_renderings for all
  using (exists (select 1 from public.events e where e.id = venue_renderings.event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = venue_renderings.event_id and e.owner_id = auth.uid()));

-- =========================================================
-- VENDORS
-- =========================================================
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category vendor_category not null,
  city text not null,
  price_band price_band not null default 'mid',
  rating numeric(2,1) not null default 4.5,
  bio text,
  cover_url text,
  contact_phone text,
  contact_email text,
  whatsapp text,
  is_sponsored boolean not null default false,
  is_approved boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vendors enable row level security;
create trigger vendors_updated before update on public.vendors for each row execute function public.set_updated_at();
create policy "vendors_public_read" on public.vendors for select using (is_approved = true);
create policy "vendors_admin_all" on public.vendors for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.vendor_portfolio (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  image_url text not null,
  caption text,
  position int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.vendor_portfolio enable row level security;
create policy "portfolio_public_read" on public.vendor_portfolio for select using (
  exists (select 1 from public.vendors v where v.id = vendor_portfolio.vendor_id and v.is_approved = true)
);
create policy "portfolio_admin_all" on public.vendor_portfolio for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.vendor_reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now()
);
alter table public.vendor_reviews enable row level security;
create policy "reviews_public_read" on public.vendor_reviews for select using (true);
create policy "reviews_insert_auth" on public.vendor_reviews for insert with check (auth.uid() = author_id);
create policy "reviews_update_own" on public.vendor_reviews for update using (auth.uid() = author_id);
create policy "reviews_delete_own_or_admin" on public.vendor_reviews for delete using (auth.uid() = author_id or public.is_admin(auth.uid()));

create table public.shortlists (
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, vendor_id)
);
alter table public.shortlists enable row level security;
create policy "shortlists_owner_all" on public.shortlists for all
  using (exists (select 1 from public.events e where e.id = shortlists.event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = shortlists.event_id and e.owner_id = auth.uid()));

-- =========================================================
-- COLLAB
-- =========================================================
create table public.collaborators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  share_token text not null unique,
  access_level collab_access not null default 'comment',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.collaborators enable row level security;
create policy "collab_owner_all" on public.collaborators for all
  using (exists (select 1 from public.events e where e.id = collaborators.event_id and e.owner_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = collaborators.event_id and e.owner_id = auth.uid()));
-- Anyone with the token URL can read this record (we will look up by token)
create policy "collab_public_by_token" on public.collaborators for select using (true);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  item_id uuid,
  author_name text not null,
  body text not null,
  vote int default 0, -- -1, 0, 1
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create policy "comments_public_read" on public.comments for select using (true);
create policy "comments_public_insert" on public.comments for insert with check (true);
create policy "comments_owner_delete" on public.comments for delete
  using (exists (select 1 from public.events e where e.id = comments.event_id and e.owner_id = auth.uid()));

alter publication supabase_realtime add table public.comments;

-- =========================================================
-- SPONSORS
-- =========================================================
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null,
  logo_url text,
  category vendor_category,
  copy text,
  link text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.sponsors enable row level security;
create policy "sponsors_public_read" on public.sponsors for select using (is_active = true);
create policy "sponsors_admin_all" on public.sponsors for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =========================================================
-- SEED: SERVICE PRICE CONFIG (per guest pricing)
-- =========================================================
insert into public.service_price_config (service, city, tier_level, base_price_per_guest, base_flat_price, notes) values
  -- Catering
  ('catering','Lagos','gold',9000,0,'Buffet jollof, fried rice, chicken, salad'),
  ('catering','Lagos','platinum',16000,0,'Premium buffet + assorted small chops'),
  ('catering','Lagos','diamond',28000,0,'Live cooking stations, continental + Nigerian'),
  ('catering','Abuja','gold',8500,0,null),
  ('catering','Abuja','platinum',15500,0,null),
  ('catering','Abuja','diamond',27000,0,null),
  ('catering','Port Harcourt','gold',9500,0,null),
  ('catering','Port Harcourt','platinum',16500,0,null),
  ('catering','Port Harcourt','diamond',29000,0,null),
  -- Drinks
  ('drinks','Lagos','gold',3500,0,'Soft drinks + water + 1 wine option'),
  ('drinks','Lagos','platinum',6500,0,'Wines, cocktails, beer, juice'),
  ('drinks','Lagos','diamond',12000,0,'Open bar, premium spirits, champagne'),
  ('drinks','Abuja','gold',3500,0,null),
  ('drinks','Abuja','platinum',6500,0,null),
  ('drinks','Abuja','diamond',12000,0,null),
  ('drinks','Port Harcourt','gold',4000,0,null),
  ('drinks','Port Harcourt','platinum',7000,0,null),
  ('drinks','Port Harcourt','diamond',12500,0,null),
  -- Venue (flat)
  ('venue','Lagos','gold',0,800000,'Hall in mainland'),
  ('venue','Lagos','platinum',0,2500000,'Premium island venue'),
  ('venue','Lagos','diamond',0,6000000,'Luxury banquet / outdoor estate'),
  ('venue','Abuja','gold',0,700000,null),
  ('venue','Abuja','platinum',0,2200000,null),
  ('venue','Abuja','diamond',0,5500000,null),
  ('venue','Port Harcourt','gold',0,650000,null),
  ('venue','Port Harcourt','platinum',0,2000000,null),
  ('venue','Port Harcourt','diamond',0,5000000,null),
  -- Decor (flat)
  ('decor','Lagos','gold',0,600000,'Solid floral + drapery'),
  ('decor','Lagos','platinum',0,1800000,'Designer decor + lighting'),
  ('decor','Lagos','diamond',0,5000000,'Showstopper installations'),
  ('decor','Abuja','gold',0,550000,null),
  ('decor','Abuja','platinum',0,1700000,null),
  ('decor','Abuja','diamond',0,4800000,null),
  ('decor','Port Harcourt','gold',0,500000,null),
  ('decor','Port Harcourt','platinum',0,1600000,null),
  ('decor','Port Harcourt','diamond',0,4500000,null),
  -- Photography (flat)
  ('photography','Lagos','gold',0,400000,null),
  ('photography','Lagos','platinum',0,900000,null),
  ('photography','Lagos','diamond',0,2200000,null),
  ('photography','Abuja','gold',0,400000,null),
  ('photography','Abuja','platinum',0,850000,null),
  ('photography','Abuja','diamond',0,2000000,null),
  ('photography','Port Harcourt','gold',0,380000,null),
  ('photography','Port Harcourt','platinum',0,800000,null),
  ('photography','Port Harcourt','diamond',0,1900000,null),
  -- DJ/Band
  ('dj','Lagos','gold',0,250000,null),
  ('dj','Lagos','platinum',0,700000,'DJ + sax/live element'),
  ('dj','Lagos','diamond',0,2000000,'Full live band + DJ'),
  ('dj','Abuja','gold',0,230000,null),
  ('dj','Abuja','platinum',0,680000,null),
  ('dj','Abuja','diamond',0,1900000,null),
  ('dj','Port Harcourt','gold',0,220000,null),
  ('dj','Port Harcourt','platinum',0,650000,null),
  ('dj','Port Harcourt','diamond',0,1800000,null),
  -- MC
  ('mc','Lagos','gold',0,150000,null),
  ('mc','Lagos','platinum',0,400000,null),
  ('mc','Lagos','diamond',0,1200000,'Celebrity MC'),
  ('mc','Abuja','gold',0,140000,null),
  ('mc','Abuja','platinum',0,380000,null),
  ('mc','Abuja','diamond',0,1100000,null),
  ('mc','Port Harcourt','gold',0,130000,null),
  ('mc','Port Harcourt','platinum',0,360000,null),
  ('mc','Port Harcourt','diamond',0,1000000,null),
  -- Makeup
  ('makeup','Lagos','gold',0,180000,null),
  ('makeup','Lagos','platinum',0,450000,null),
  ('makeup','Lagos','diamond',0,1200000,'Top celebrity MUA'),
  ('makeup','Abuja','gold',0,170000,null),
  ('makeup','Abuja','platinum',0,420000,null),
  ('makeup','Abuja','diamond',0,1100000,null),
  ('makeup','Port Harcourt','gold',0,160000,null),
  ('makeup','Port Harcourt','platinum',0,400000,null),
  ('makeup','Port Harcourt','diamond',0,1000000,null),
  -- Cake
  ('cake','Lagos','gold',0,150000,null),
  ('cake','Lagos','platinum',0,400000,null),
  ('cake','Lagos','diamond',0,1200000,null),
  ('cake','Abuja','gold',0,140000,null),
  ('cake','Abuja','platinum',0,380000,null),
  ('cake','Abuja','diamond',0,1100000,null),
  ('cake','Port Harcourt','gold',0,130000,null),
  ('cake','Port Harcourt','platinum',0,360000,null),
  ('cake','Port Harcourt','diamond',0,1000000,null),
  -- Aso Ebi (per guest)
  ('aso_ebi','Lagos','gold',15000,0,null),
  ('aso_ebi','Lagos','platinum',35000,0,null),
  ('aso_ebi','Lagos','diamond',75000,0,null),
  ('aso_ebi','Abuja','gold',15000,0,null),
  ('aso_ebi','Abuja','platinum',35000,0,null),
  ('aso_ebi','Abuja','diamond',75000,0,null),
  ('aso_ebi','Port Harcourt','gold',14000,0,null),
  ('aso_ebi','Port Harcourt','platinum',33000,0,null),
  ('aso_ebi','Port Harcourt','diamond',72000,0,null),
  -- Souvenirs (per guest)
  ('souvenirs','Lagos','gold',2500,0,null),
  ('souvenirs','Lagos','platinum',6000,0,null),
  ('souvenirs','Lagos','diamond',15000,0,null),
  ('souvenirs','Abuja','gold',2500,0,null),
  ('souvenirs','Abuja','platinum',6000,0,null),
  ('souvenirs','Abuja','diamond',15000,0,null),
  ('souvenirs','Port Harcourt','gold',2200,0,null),
  ('souvenirs','Port Harcourt','platinum',5800,0,null),
  ('souvenirs','Port Harcourt','diamond',14500,0,null),
  -- Security
  ('security','Lagos','gold',0,150000,null),
  ('security','Lagos','platinum',0,350000,null),
  ('security','Lagos','diamond',0,800000,null),
  ('security','Abuja','gold',0,140000,null),
  ('security','Abuja','platinum',0,330000,null),
  ('security','Abuja','diamond',0,750000,null),
  ('security','Port Harcourt','gold',0,130000,null),
  ('security','Port Harcourt','platinum',0,310000,null),
  ('security','Port Harcourt','diamond',0,700000,null),
  -- Logistics
  ('logistics','Lagos','gold',0,200000,null),
  ('logistics','Lagos','platinum',0,500000,null),
  ('logistics','Lagos','diamond',0,1500000,null),
  ('logistics','Abuja','gold',0,180000,null),
  ('logistics','Abuja','platinum',0,470000,null),
  ('logistics','Abuja','diamond',0,1400000,null),
  ('logistics','Port Harcourt','gold',0,170000,null),
  ('logistics','Port Harcourt','platinum',0,450000,null),
  ('logistics','Port Harcourt','diamond',0,1300000,null);

-- =========================================================
-- SEED: VENDORS (30+ realistic Nigerian vendors)
-- =========================================================
insert into public.vendors (name, category, city, price_band, rating, bio, contact_phone, whatsapp, is_sponsored) values
  ('Wild Flowers Lagos','decor','Lagos','luxury',4.9,'Premium floral and decor studio behind some of Lagos''s most talked-about weddings.','+2348012345601','+2348012345601',true),
  ('Tobi Solomon Decor','decor','Lagos','premium',4.8,'Elegant, romantic decor with signature drapery and chandelier installations.','+2348012345602','+2348012345602',false),
  ('Adure Designs','decor','Abuja','premium',4.7,'Abuja-based decor house known for clean modern looks with Nigerian flair.','+2348012345603','+2348012345603',false),
  ('Velvet Touch Events','decor','Port Harcourt','mid',4.6,'Affordable, beautifully styled decor across South-South Nigeria.','+2348012345604','+2348012345604',false),

  ('Kessavibes Catering','catering','Lagos','luxury',4.9,'Luxury Nigerian and continental catering with live cooking stations.','+2348012345605','+2348012345605',true),
  ('Sweet Kiwi Kitchen','catering','Lagos','premium',4.7,'Modern Nigerian small chops, jollof and grills the crowd loves.','+2348012345606','+2348012345606',false),
  ('Plate by Tara','catering','Abuja','premium',4.8,'Refined plated dinners with a Naija-fusion twist.','+2348012345607','+2348012345607',false),
  ('Mama Nkechi Foods','catering','Port Harcourt','affordable',4.5,'Authentic local catering with generous portions and warm service.','+2348012345608','+2348012345608',false),

  ('Klala Photography','photography','Lagos','luxury',5.0,'Award-winning wedding photographer behind iconic Owanbe stories.','+2348012345609','+2348012345609',true),
  ('Big H Studios','photography','Lagos','premium',4.8,'Cinematic wedding films and editorial photo coverage.','+2348012345610','+2348012345610',false),
  ('Emmanuel Oyeleke','photography','Abuja','luxury',4.9,'Renowned Nigerian wedding and lifestyle photographer.','+2348012345611','+2348012345611',false),
  ('Lensman PH','photography','Port Harcourt','mid',4.6,'Trusted Port Harcourt wedding photographers since 2014.','+2348012345612','+2348012345612',false),

  ('DJ Spinall','dj','Lagos','luxury',5.0,'The Cap! Nigeria''s most celebrated celebrity DJ.','+2348012345613','+2348012345613',true),
  ('DJ Obi','dj','Lagos','premium',4.8,'High-energy Owanbe and afrobeats specialist.','+2348012345614','+2348012345614',false),
  ('DJ Kentalky','dj','Abuja','premium',4.7,'Abuja''s go-to DJ for elite weddings and celebrations.','+2348012345615','+2348012345615',false),
  ('DJ Real PH','dj','Port Harcourt','mid',4.5,'Port Harcourt mainstay with a deep Owanbe library.','+2348012345616','+2348012345616',false),

  ('MC Lively','mc','Lagos','luxury',4.9,'One of Nigeria''s most loved hype MCs.','+2348012345617','+2348012345617',false),
  ('MC Edo Pikin','mc','Lagos','premium',4.7,'Comedy + crowd control specialist for big Owanbes.','+2348012345618','+2348012345618',false),
  ('MC Chidi Smart','mc','Abuja','premium',4.6,'Polished bilingual MC for high-profile Abuja events.','+2348012345619','+2348012345619',false),

  ('Banke Meshida-Lawal (BMPro)','makeup','Lagos','luxury',5.0,'Iconic celebrity makeup artist; the BMPro signature glam.','+2348012345620','+2348012345620',true),
  ('House of Tara','makeup','Lagos','premium',4.7,'Beautiful bridal looks with wide range of complexions.','+2348012345621','+2348012345621',false),
  ('Glam by Joyce','makeup','Abuja','mid',4.6,'Soft glam and full glam bridal beauty in Abuja.','+2348012345622','+2348012345622',false),
  ('Dorcas Beauty PH','makeup','Port Harcourt','mid',4.5,'Trusted PH bridal MUA with a loyal client base.','+2348012345623','+2348012345623',false),

  ('Komole Kandids','aso_ebi','Lagos','luxury',4.8,'Curated Aso Ebi with rich brocade and Swarovski options.','+2348012345624','+2348012345624',false),
  ('Ankara Republic','aso_ebi','Lagos','mid',4.6,'Affordable, vibrant Ankara and lace selections at scale.','+2348012345625','+2348012345625',false),
  ('Asoebi by Tito','aso_ebi','Abuja','premium',4.7,'Designer Aso Ebi with bespoke styling support.','+2348012345626','+2348012345626',false),

  ('Cakes by Tosan','cake','Lagos','premium',4.9,'Award-winning cake designer with sculptural pieces.','+2348012345627','+2348012345627',false),
  ('Sweet Indulgence','cake','Lagos','mid',4.6,'Beautiful traditional and modern wedding cakes.','+2348012345628','+2348012345628',false),
  ('Naphtali Cakes','cake','Abuja','premium',4.7,'Abuja''s pride for showstopping multi-tier cakes.','+2348012345629','+2348012345629',false),

  ('Eko Hotel Banquet','venue','Lagos','luxury',4.8,'Iconic Lagos venue for weddings and receptions.','+2348012345630','+2348012345630',true),
  ('Federal Palace','venue','Lagos','premium',4.7,'Classic luxury hotel venue on Victoria Island.','+2348012345631','+2348012345631',false),
  ('Transcorp Hilton','venue','Abuja','luxury',4.9,'Abuja''s premier event venue.','+2348012345632','+2348012345632',false),
  ('Hotel Presidential','venue','Port Harcourt','premium',4.5,'Storied Port Harcourt venue for grand celebrations.','+2348012345633','+2348012345633',false);

-- =========================================================
-- SEED: SPONSORS
-- =========================================================
insert into public.sponsors (brand_name, category, copy, link) values
  ('Hennessy', 'drinks', 'Pour the moment with Hennessy V.S.O.P', 'https://hennessy.com'),
  ('Moët & Chandon', 'drinks', 'Celebrate in style with Moët', 'https://moet.com'),
  ('Coca-Cola', 'drinks', 'Refresh every guest with Coca-Cola', 'https://coca-cola.com'),
  ('Indomie', 'catering', 'Indomie small chops table — kids favourite', 'https://indomie.com'),
  ('GTBank', 'logistics', 'Simplify event payments with GTBank', 'https://gtbank.com'),
  ('Ankara Republic', 'aso_ebi', 'Premium Aso Ebi for your big day', 'https://ankararepublic.ng');
