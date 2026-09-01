# OwanbeX — Service-Gate Server-Side Enforcement (Workstream 2)

Closes the **Rubba-class paywall bypass**: gates were enforced only in the
browser, so a paying feature could be used for free — and payments could be
self-granted. This makes the gate authoritative at the database + edge-function
layer. Default-to-free and no-redeploy admin propagation (already correct) are
preserved.

## What was broken (audited in the shipped code)

| # | Severity | Defect |
|---|----------|--------|
| D1 | Critical | `GateGuard` only hid the React page. The gated tables (`guests`, `guest_lists`, `aso_ebi_*`, `event_selections`, `events`) had owner-only RLS with **no payment check** — a logged-in owner bypassed any paywall with a direct `supabase.from(...).insert(...)`. |
| D2 | Critical | `service_payments` RLS was `FOR ALL … WITH CHECK (user_id = auth.uid())`. Any user could insert their own `status:'paid'` row and self-unlock everything. There was **no server-side writer** of that table (only dead client code). |
| D3 | High (functional) | Service checkout was dead: `GateGuard.pay()` called `zonicme-payment` with `plan:"service:…"`, unknown to the function's `PLANS`, so it returned `Unknown plan` 400. No `verify` branch recorded a service payment. Switching a gate on made the feature **permanently unpayable**. |

Passing already (kept): default-to-free (`service_gates.enabled default false`),
admin propagation without redeploy (live DB read per mount + audit trail),
super-admin-only gate writes, and the **brand** plan path (untouched).

## Files changed

1. **`supabase/migrations/20260901120000_service_gate_server_enforcement.sql`** (new)
   - `public.service_unlocked(uid, service, event)` — SECURITY DEFINER, mirrors
     `gateBlocks()` server-side (gate off ⇒ free; `per_event` ⇒ must match the
     event; else account-wide).
   - Splits the owner `FOR ALL` policies on every gated write surface into
     SELECT/DELETE (ungated — never lock a user out of their own data) and
     INSERT/UPDATE (require `service_unlocked`).
   - Locks `service_payments` to **read-only** for users; only the service role
     (edge function) writes.
2. **`supabase/functions/zonicme-payment/index.ts`** (patched)
   - `initialize` handles `plan="service:<svc>[:<eventId>]"`: price/model read
     **server-side** from `service_gates`, caller identity from the JWT (not the
     body), redirect back with `?svcpay=<ref>`.
   - `verify` settles a service payment: verifies with the provider, then writes
     the `service_payments` row (service role) with idempotency on `reference`.
     Now tries each available provider instead of guessing one.
   - Brand plan path unchanged.
3. **`src/components/GateGuard.tsx`** (patched) — on return from checkout
   (`?svcpay=<ref>`) it calls `verify`, then reloads so the gate re-checks and
   unlocks. Client never records the payment.
4. **`src/lib/service-gates.ts`** (patched) — removed the dead, unsafe
   client-side `recordServicePayment()`.

## Gate → enforced write surface

| Gate | Tables (INSERT/UPDATE gated) | Model |
|------|------------------------------|-------|
| `guest_list` | `guest_lists`, `guests` | per_event |
| `aso_ebi` | `aso_ebi_campaigns`, `aso_ebi_quotes`, `aso_ebi_orders`, `aso_ebi_guest_orders` | per_event |
| `ecommerce` | `event_selections` | per_event |
| `event_management` | `events` (INSERT only) | account-wide |
| `registration` | **not enforced here** — see below | account-wide |

## Deploy steps (in your env — inherent, not leftover work)

1. **Apply the migration**
   ```bash
   supabase db push        # or: supabase migration up
   ```
2. **Deploy the edge function**
   ```bash
   supabase functions deploy zonicme-payment
   ```
   Confirm secrets exist: `FLUTTERWAVE_SECRET_KEY` and/or `PAYSTACK_SECRET_KEY`
   (plus the auto-provided `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`).
3. **Rebuild the frontend** (Cursor) — `GateGuard.tsx` / `service-gates.ts`
   changed. `npm run build` and confirm `tsc` is clean.

## How to verify the fix (do these after deploy)

- **Bypass is closed (D1):** as a normal user, in the browser console try
  `await supabase.from('guests').insert({ list_id:'<your list>', name:'x' })`
  while the `guest_list` gate is **enabled & unpaid** → expect an RLS error.
  Disable the gate (or pay) → the same insert succeeds.
- **Self-grant is closed (D2):**
  `await supabase.from('service_payments').insert({ user_id:'<me>', service:'aso_ebi', status:'paid' })`
  → expect an RLS error (users have SELECT only).
- **Checkout works (D3):** enable a gate with a price, open the feature, click
  **Unlock now** → gateway opens → on return the feature unlocks and a
  `service_payments` row exists.
- **Default-to-free unchanged:** with a gate disabled, the feature is fully
  usable and no payment is requested.

## Notes / deliberate scope

- **`registration`** is a whole-account access gate, not a single-table write
  gate. Enforcing it server-side means paywalling the entire account (gating
  every owner SELECT on `service_unlocked`). That's a product decision, so it is
  **not** applied. Say the word and I'll add it behind a clear free-by-default.
- Keep `event_management` / `registration` on `one_off`/`subscription`
  (account-wide), **not** `per_event` — a per_event model on an account-wide
  creation gate would never match and would block creation even after payment.
- `subscription` currently unlocks on any paid row (no expiry), matching the
  existing `gateBlocks()` behaviour. Add a `period_end` check later if you want
  true expiring subscriptions.

## Verification status

Hand-reviewed: brace/paren balance clean on all TS files; SQL `$$`/`begin…end;`/
policy structure checked. No compiler was run in this environment — run
`npm run build` + `supabase db push` in your env for the authoritative check,
per our usual convention.
