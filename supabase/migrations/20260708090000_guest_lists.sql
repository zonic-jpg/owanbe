-- Guest list management: per-event lists with full contact tables,
-- category segmentation (VIP first), RSVP + invitation status with sent-via
-- channel tracking. Owner-scoped RLS; admins can read for support.

create table if not exists public.guest_lists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Main list',
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.guest_lists(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  category text not null default 'other'
    check (category in ('vip','family','friends','colleagues','other')),
  plus_ones int not null default 0 check (plus_ones >= 0 and plus_ones <= 20),
  table_no int,
  rsvp_status text not null default 'none'
    check (rsvp_status in ('none','yes','no','maybe')),
  invite_status text not null default 'pending'
    check (invite_status in ('pending','sent')),
  sent_via text
    check (sent_via is null or sent_via in ('whatsapp','sms','email','card','call')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_guests_list on public.guests(list_id);
create index if not exists idx_guest_lists_event on public.guest_lists(event_id);

alter table public.guest_lists enable row level security;
alter table public.guests enable row level security;

-- Owners manage their own lists; admins can read.
do $$ begin
  if not exists (select 1 from pg_policies where tablename='guest_lists' and policyname='guest_lists_owner_all') then
    create policy guest_lists_owner_all on public.guest_lists
      for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='guest_lists' and policyname='guest_lists_admin_read') then
    create policy guest_lists_admin_read on public.guest_lists
      for select using (public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='guests' and policyname='guests_owner_all') then
    create policy guests_owner_all on public.guests
      for all using (exists (select 1 from public.guest_lists gl where gl.id = list_id and gl.owner_id = auth.uid()))
      with check (exists (select 1 from public.guest_lists gl where gl.id = list_id and gl.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='guests' and policyname='guests_admin_read') then
    create policy guests_admin_read on public.guests
      for select using (public.is_admin(auth.uid()));
  end if;
end $$;
