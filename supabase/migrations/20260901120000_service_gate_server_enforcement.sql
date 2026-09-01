-- ═══════════════════════════════════════════════════════════════════════════
-- SERVER-SIDE SERVICE-GATE ENFORCEMENT  (closes the Rubba-class paywall bypass)
-- ---------------------------------------------------------------------------
-- Before this migration the gates were COSMETIC:
--   D1  GateGuard only hid the React page; the underlying owner-scoped tables
--       (guests, guest_lists, aso_ebi_*, event_selections, events) had no
--       payment check, so a logged-in owner could bypass any paywall with a
--       direct supabase.from(...).insert(...) call.
--   D2  service_payments had `FOR ALL ... WITH CHECK (user_id = auth.uid())`,
--       so any user could insert their own status='paid' row and self-unlock
--       every service for free. There was NO server-side writer of that table.
--
-- This migration makes the gate authoritative:
--   1. public.service_unlocked(uid, service, event)  — mirrors gateBlocks()
--      server-side (gate off => free; per_event => must match event; else
--      account-wide). SECURITY DEFINER, search_path locked.
--   2. Replaces the owner "FOR ALL" policies on every gated write surface with
--      split policies: SELECT/DELETE stay owner-only (never lock a user out of
--      their own data); INSERT/UPDATE additionally require service_unlocked(...).
--   3. Locks service_payments to READ-ONLY for users. Only the service role
--      (the zonicme-payment edge function, post provider-verification) may
--      insert a paid row.  Payments are now un-forgeable from the client.
--
-- Gate → write-surface map (models come from service_gates.model at runtime):
--   guest_list        -> guest_lists, guests            (per_event)
--   aso_ebi           -> aso_ebi_campaigns/quotes/orders/guest_orders (per_event)
--   ecommerce         -> event_selections               (per_event)
--   event_management  -> events (INSERT only)           (account-wide)
--   registration      -> NOT enforced here (whole-account access gate; see note)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Authoritative unlock check ──────────────────────────────────────────
create or replace function public.service_unlocked(
  _uid uuid, _service text, _event uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.service_gates%rowtype;
  ok boolean;
begin
  if _uid is null then
    return false;
  end if;

  select * into g from public.service_gates where service = _service;

  -- Gate missing or disabled => the service is free (default-to-free).
  if not found or g.enabled = false then
    return true;
  end if;

  if g.model = 'per_event' then
    select exists (
      select 1 from public.service_payments p
      where p.user_id = _uid
        and p.service = _service
        and p.status  = 'paid'
        and p.event_id is not distinct from _event
    ) into ok;
  else
    -- one_off / subscription: account-wide unlock
    select exists (
      select 1 from public.service_payments p
      where p.user_id = _uid
        and p.service = _service
        and p.status  = 'paid'
    ) into ok;
  end if;

  return ok;
end;
$$;

comment on function public.service_unlocked(uuid, text, uuid) is
  'Server-side gate check mirroring src/lib/service-gates.ts gateBlocks(): true when the service is free, or the user holds a matching paid service_payment.';

-- ── 2. Lock service_payments to read-only for users ────────────────────────
-- Only the service role (edge function) may write, and it bypasses RLS.
drop policy if exists svc_pay_own on public.service_payments;
drop policy if exists svc_pay_own_read on public.service_payments;
create policy svc_pay_own_read on public.service_payments
  for select using (user_id = auth.uid());
-- (svc_pay_admin_read from the prior migration remains in place.)

-- ── 3. Gate the write surfaces ─────────────────────────────────────────────
-- Pattern per table: drop the owner "FOR ALL" policy (permissive ALL policies
-- are OR-combined, so leaving it would defeat the gate), then recreate as
-- SELECT + DELETE (ungated) and INSERT + UPDATE (gated on service_unlocked).

-- 3a. guest_list -> guest_lists (event_id direct) ---------------------------
drop policy if exists guest_lists_owner_all on public.guest_lists;
create policy guest_lists_owner_select on public.guest_lists
  for select using (owner_id = auth.uid());
create policy guest_lists_owner_delete on public.guest_lists
  for delete using (owner_id = auth.uid());
create policy guest_lists_owner_insert on public.guest_lists
  for insert with check (
    owner_id = auth.uid()
    and public.service_unlocked(auth.uid(), 'guest_list', event_id)
  );
create policy guest_lists_owner_update on public.guest_lists
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and public.service_unlocked(auth.uid(), 'guest_list', event_id)
  );

-- 3b. guest_list -> guests (event_id via list) ------------------------------
drop policy if exists guests_owner_all on public.guests;
create policy guests_owner_select on public.guests
  for select using (
    exists (select 1 from public.guest_lists gl where gl.id = list_id and gl.owner_id = auth.uid())
  );
create policy guests_owner_delete on public.guests
  for delete using (
    exists (select 1 from public.guest_lists gl where gl.id = list_id and gl.owner_id = auth.uid())
  );
create policy guests_owner_insert on public.guests
  for insert with check (
    exists (select 1 from public.guest_lists gl where gl.id = list_id and gl.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'guest_list',
      (select gl.event_id from public.guest_lists gl where gl.id = list_id)
    )
  );
create policy guests_owner_update on public.guests
  for update using (
    exists (select 1 from public.guest_lists gl where gl.id = list_id and gl.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.guest_lists gl where gl.id = list_id and gl.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'guest_list',
      (select gl.event_id from public.guest_lists gl where gl.id = list_id)
    )
  );

-- 3c. aso_ebi -> aso_ebi_campaigns (event_id direct) ------------------------
drop policy if exists asoebi_owner_all on public.aso_ebi_campaigns;
create policy asoebi_campaigns_select on public.aso_ebi_campaigns
  for select using (owner_id = auth.uid());
create policy asoebi_campaigns_delete on public.aso_ebi_campaigns
  for delete using (owner_id = auth.uid());
create policy asoebi_campaigns_insert on public.aso_ebi_campaigns
  for insert with check (
    owner_id = auth.uid()
    and public.service_unlocked(auth.uid(), 'aso_ebi', event_id)
  );
create policy asoebi_campaigns_update on public.aso_ebi_campaigns
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and public.service_unlocked(auth.uid(), 'aso_ebi', event_id)
  );

-- Helper expression reused below: the event_id behind a campaign.
-- 3d. aso_ebi -> aso_ebi_quotes (event via campaign) ------------------------
drop policy if exists asoebi_quotes_owner on public.aso_ebi_quotes;
create policy asoebi_quotes_select on public.aso_ebi_quotes
  for select using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
create policy asoebi_quotes_delete on public.aso_ebi_quotes
  for delete using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
create policy asoebi_quotes_insert on public.aso_ebi_quotes
  for insert with check (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'aso_ebi',
      (select c.event_id from public.aso_ebi_campaigns c where c.id = campaign_id)
    )
  );
create policy asoebi_quotes_update on public.aso_ebi_quotes
  for update using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'aso_ebi',
      (select c.event_id from public.aso_ebi_campaigns c where c.id = campaign_id)
    )
  );

-- 3e. aso_ebi -> aso_ebi_orders (event via campaign) ------------------------
drop policy if exists asoebi_orders_owner on public.aso_ebi_orders;
create policy asoebi_orders_select on public.aso_ebi_orders
  for select using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
create policy asoebi_orders_delete on public.aso_ebi_orders
  for delete using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
create policy asoebi_orders_insert on public.aso_ebi_orders
  for insert with check (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'aso_ebi',
      (select c.event_id from public.aso_ebi_campaigns c where c.id = campaign_id)
    )
  );
create policy asoebi_orders_update on public.aso_ebi_orders
  for update using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'aso_ebi',
      (select c.event_id from public.aso_ebi_campaigns c where c.id = campaign_id)
    )
  );

-- 3f. aso_ebi -> aso_ebi_guest_orders (event via campaign) ------------------
drop policy if exists asoebi_guest_orders_owner on public.aso_ebi_guest_orders;
create policy asoebi_guest_orders_select on public.aso_ebi_guest_orders
  for select using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
create policy asoebi_guest_orders_delete on public.aso_ebi_guest_orders
  for delete using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  );
create policy asoebi_guest_orders_insert on public.aso_ebi_guest_orders
  for insert with check (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'aso_ebi',
      (select c.event_id from public.aso_ebi_campaigns c where c.id = campaign_id)
    )
  );
create policy asoebi_guest_orders_update on public.aso_ebi_guest_orders
  for update using (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.aso_ebi_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
    and public.service_unlocked(
      auth.uid(), 'aso_ebi',
      (select c.event_id from public.aso_ebi_campaigns c where c.id = campaign_id)
    )
  );

-- 3g. ecommerce -> event_selections (event_id direct) -----------------------
drop policy if exists sel_owner_all on public.event_selections;
create policy sel_owner_select on public.event_selections
  for select using (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
  );
create policy sel_owner_delete on public.event_selections
  for delete using (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
  );
create policy sel_owner_insert on public.event_selections
  for insert with check (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
    and public.service_unlocked(auth.uid(), 'ecommerce', event_id)
  );
create policy sel_owner_update on public.event_selections
  for update using (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.owner_id = auth.uid())
    and public.service_unlocked(auth.uid(), 'ecommerce', event_id)
  );

-- 3h. event_management -> events (INSERT only; account-wide) -----------------
-- Gating creation is the paid action. UPDATE/DELETE of an already-created event
-- stay ungated so flipping the gate on can never lock an owner out of an event
-- they already own.
drop policy if exists events_owner_all on public.events;
create policy events_owner_select on public.events
  for select using (auth.uid() = owner_id);
create policy events_owner_delete on public.events
  for delete using (auth.uid() = owner_id);
create policy events_owner_update on public.events
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy events_owner_insert on public.events
  for insert with check (
    auth.uid() = owner_id
    and public.service_unlocked(auth.uid(), 'event_management', null)
  );

-- ── NOTE on 'registration' ─────────────────────────────────────────────────
-- The registration gate (Dashboard.tsx) is a WHOLE-ACCOUNT access gate, not a
-- single-table write gate. Enforcing it server-side means gating every owner
-- SELECT policy on service_unlocked(...,'registration',...) — i.e. paywalling
-- the entire account. That is a product decision, not a bug fix, so it is
-- deliberately NOT applied here. If you want it, say so and I'll gate the read
-- policies behind unlock (with a clear "free until you enable it" default).
