-- ═══ SERVICE PAYMENT GATES ═══
create table if not exists public.service_gates (
  service text primary key check (service in ('registration','ecommerce','guest_list','aso_ebi','event_management')),
  enabled boolean not null default false,
  price numeric not null default 0 check (price >= 0),
  currency text not null default 'NGN',
  model text not null default 'one_off' check (model in ('one_off','per_event','subscription')),
  label text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create table if not exists public.service_gate_audit (
  id uuid primary key default gen_random_uuid(),
  service text not null, action text not null,
  old_value jsonb, new_value jsonb,
  actor uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.service_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null,
  event_id uuid references public.events(id) on delete set null,
  amount numeric not null default 0, currency text not null default 'NGN',
  provider text, reference text, status text not null default 'paid' check (status in ('paid','refunded')),
  created_at timestamptz not null default now()
);
create index if not exists idx_service_payments_user on public.service_payments(user_id, service);
insert into public.service_gates (service, label) values
  ('registration','Account registration'),
  ('ecommerce','E-commerce & catalog'),
  ('guest_list','Guest list management'),
  ('aso_ebi','Aso-ebi management'),
  ('event_management','Full event management')
on conflict (service) do nothing;
alter table public.service_gates enable row level security;
alter table public.service_gate_audit enable row level security;
alter table public.service_payments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='service_gates' and policyname='gates_read_all') then
    create policy gates_read_all on public.service_gates for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='service_gates' and policyname='gates_write_super') then
    create policy gates_write_super on public.service_gates for update using (public.has_role(auth.uid(),'super_admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='service_gate_audit' and policyname='gate_audit_admin_read') then
    create policy gate_audit_admin_read on public.service_gate_audit for select using (public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='service_gate_audit' and policyname='gate_audit_super_write') then
    create policy gate_audit_super_write on public.service_gate_audit for insert with check (public.has_role(auth.uid(),'super_admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='service_payments' and policyname='svc_pay_own') then
    create policy svc_pay_own on public.service_payments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='service_payments' and policyname='svc_pay_admin_read') then
    create policy svc_pay_admin_read on public.service_payments for select using (public.is_admin(auth.uid()));
  end if;
end $$;

-- ═══ ASO-EBI PORTAL ═══
create table if not exists public.aso_ebi_campaigns (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Aso-ebi',
  fabric_type text, colors text, qty_estimate int, budget_per_unit numeric,
  requirements text, deadline date,
  status text not null default 'open' check (status in ('draft','open','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.aso_ebi_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, whatsapp text, city text,
  specialties text, vetted boolean not null default false,
  rating numeric check (rating is null or (rating >= 0 and rating <= 5)),
  notes text, created_at timestamptz not null default now()
);
create table if not exists public.aso_ebi_quotes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.aso_ebi_campaigns(id) on delete cascade,
  provider_id uuid not null references public.aso_ebi_providers(id) on delete cascade,
  fabric text, price_per_unit numeric not null check (price_per_unit >= 0),
  min_order int not null default 1, delivery_days int,
  notes text,
  status text not null default 'received' check (status in ('received','shortlisted','accepted','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.aso_ebi_orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.aso_ebi_campaigns(id) on delete cascade,
  quote_id uuid not null references public.aso_ebi_quotes(id),
  provider_name text not null, fabric text,
  qty int not null check (qty > 0), unit_price numeric not null, total numeric not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  payment_provider text, payment_reference text,
  ai_summary text,
  created_at timestamptz not null default now()
);
create table if not exists public.aso_ebi_guest_orders (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.aso_ebi_campaigns(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  qty int not null default 1 check (qty > 0),
  amount numeric not null default 0,
  paid boolean not null default false,
  measurements text, collected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_id, guest_id)
);
create index if not exists idx_asoebi_quotes_campaign on public.aso_ebi_quotes(campaign_id);
create index if not exists idx_asoebi_guest_orders_campaign on public.aso_ebi_guest_orders(campaign_id);
alter table public.aso_ebi_campaigns enable row level security;
alter table public.aso_ebi_providers enable row level security;
alter table public.aso_ebi_quotes enable row level security;
alter table public.aso_ebi_orders enable row level security;
alter table public.aso_ebi_guest_orders enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='aso_ebi_campaigns' and policyname='asoebi_owner_all') then
    create policy asoebi_owner_all on public.aso_ebi_campaigns for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
    create policy asoebi_admin_read on public.aso_ebi_campaigns for select using (public.is_admin(auth.uid()));
    create policy asoebi_providers_read on public.aso_ebi_providers for select using (auth.uid() is not null);
    create policy asoebi_providers_admin_write on public.aso_ebi_providers for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
    create policy asoebi_quotes_owner on public.aso_ebi_quotes for all
      using (exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()))
      with check (exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()));
    create policy asoebi_orders_owner on public.aso_ebi_orders for all
      using (exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()))
      with check (exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()));
    create policy asoebi_guest_orders_owner on public.aso_ebi_guest_orders for all
      using (exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()))
      with check (exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid()));
  end if;
end $$;
-- Vetted provider seed (real market segments; admin can edit)
insert into public.aso_ebi_providers (name, phone, whatsapp, city, specialties, vetted, rating, notes) values
  ('Balogun Fabrics Direct','+2348021110001','+2348021110001','Lagos','Swiss lace, French lace, George','true','4.8','Balogun market anchor stall; bulk discounts above 50 units'),
  ('Kano Ankara Hub','+2348021110002','+2348021110002','Kano','Ankara, Atamfa, wax prints','true','4.6','Northern print specialist; 3-day national delivery'),
  ('Aba Textile Queens','+2348021110003','+2348021110003','Aba','Ankara, Adire, cotton blends','true','4.5','Competitive pricing; sewing coordination available'),
  ('Idumota Lace House','+2348021110004','+2348021110004','Lagos','Premium cord lace, tulle, sequined','true','4.9','High-end weddings; sample swatches on request'),
  ('Abuja Aso-Oke Collective','+2348021110005','+2348021110005','Abuja','Aso-oke, gele, ipele sets','true','4.7','Traditional weaves; matching gele bundles'),
  ('Onitsha Bridal Fabrics','+2348021110006','+2348021110006','Onitsha','George, Hollandais, velvet','true','4.4','East market rates; WhatsApp catalogue'),
  ('Ibadan Adire Works','+2348021110007','+2348021110007','Ibadan','Adire, Kampala, tie-dye','true','4.3','Custom dye runs from 30 units'),
  ('Surulere Fabric Express','+2348021110008','+2348021110008','Lagos','Mixed stock, budget ankara','false','3.9','Pending vetting; fast mainland delivery')
on conflict do nothing;
