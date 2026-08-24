# Owanbe Joy — API Dependencies, Backup Plan & Costs

_Last reviewed: June 2026. Prices for outside services change often — treat the
figures here as a starting point and confirm against each provider's own invoice
or pricing page._

This app no longer depends on Lovable. AI is now provider-agnostic (any
OpenAI-compatible endpoint you configure), Google sign-in uses Supabase's own
OAuth, and the dev build plugin has been removed.

This document covers, in plain language:

1. Every outside service the app depends on
2. A three-layer backup plan for each, so the app keeps working if one fails
3. What each service costs
4. How logins work for real users, brands, and admins in production

---

## 1. Dependency table

| # | Service | What it does for us | Where it's used | Critical? | Key / env |
|---|---------|--------------------|----------------|-----------|-----------|
| 1 | **Supabase** | Database, user logins, file storage, server functions | Everywhere | **Yes** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` |
| 2 | **AI provider — text (configurable)** | Writes the AI summaries for events and brands | `event-ai-summary`, `brand-ai-summary` functions | No (has fallback) | `AI_API_URL`, `AI_API_KEY`, `AI_TEXT_MODEL` |
| 3 | **AI provider — image (configurable)** | Generates vendor cover photos | `generate-vendor-covers` function | No (has fallback) | `AI_IMAGE_URL`, `AI_API_KEY`, `AI_IMAGE_MODEL` |
| 4 | **Google sign-in (Supabase OAuth)** | "Continue with Google" login | Sign-in page | No (email login also exists) | Configure Google provider in Supabase Auth |
| 5 | **Email delivery (via Supabase)** | Verification & password-reset emails | Sign-up / reset | Medium | Supabase Auth settings |
| 6 | **WhatsApp deep links (`wa.me`)** | "Chat on WhatsApp" buttons | Vendor profile, shortlist | No | None (free, no key) |
| 7 | **Payment processor — _not yet wired_** | Take brand subscription / booking payments | Brand plan page (currently mock) | Will be, for paid features | To add: Paystack/Flutterwave keys |

The AI provider is whatever you point `AI_API_URL` / `AI_API_KEY` at — OpenAI,
Groq, Together, OpenRouter, a self-hosted gateway, or an Anthropic-compatible
proxy. Defaults to OpenAI's endpoint if you don't override it.

---

## 2. Three-layer backup plan (triple redundancy)

Every dependency has a **primary**, a **secondary**, and a **last-resort graceful
fallback**. Items already in the code are marked _(in place)_; recommended next
steps are marked _(to add)_.

### 1. Supabase (database, auth, storage)
- **Layer 1 — Primary:** Supabase live database and auth.
- **Layer 2 — Cached / mock data _(in place)_:** Admin "Data mode" switch lets the
  app serve cached/seeded sample data so pages still render if the live database
  is unreachable; React Query keeps recently-loaded data available.
- **Layer 3 — Graceful degradation:** Read-only mode with a clear status banner;
  writes are blocked rather than failing silently. _(banner: to add)_

### 2 & 3. AI summaries and AI cover images (your AI provider)
- **Layer 1 — Primary:** Your configured AI provider (OpenAI-compatible).
- **Layer 2 — Alternate provider _(to add)_:** Set `AI_API_URL`/`AI_API_KEY` to a
  second provider; the functions are written against the standard format so
  switching is a config change, not a rewrite.
- **Layer 3 — No-AI fallback _(in place)_:**
  - **Summaries:** if AI is unset or fails, the function returns a built-in
    rule-based summary computed from the real numbers (totals, top line item,
    budget tracking) — it never returns an error to the user.
  - **Cover images:** if image generation is unset or fails, vendors use the
    **bundled, on-theme stock photos** (four per category) that ship with the app,
    so every card always has a relevant picture.

### 4. Google sign-in (Supabase OAuth)
- **Layer 1 — Primary:** Google OAuth via Supabase.
- **Layer 2 — Email + password _(in place)_:** Works independently of Google.
- **Layer 3 — Email magic link / one-time code _(to add)_.**

### 5. Email delivery
- **Layer 1 — Primary:** Supabase's built-in email.
- **Layer 2 — Custom SMTP _(to add)_:** Plug a dedicated sender (e.g. Resend or
  SendGrid) into Supabase for higher deliverability and volume.
- **Layer 3 — Manual / in-app:** Admin can confirm a stuck account from the Roles
  tab; verification status is shown in-app.

### 7. Payments _(when added)_
- **Layer 1 — Primary:** Paystack.
- **Layer 2 — Secondary gateway:** Flutterwave behind the same checkout.
- **Layer 3 — Manual:** Bank-transfer instructions + an admin "mark as paid"
  action, so a sale is never lost to a gateway outage.

---

## 3. Costs

### Platform / usage costs

| Service | Free tier | Paid | Notes |
|---------|-----------|------|-------|
| **Supabase** | $0 — 500 MB DB, 50k monthly active users, ~500k function calls; **project pauses after 7 days idle** | **Pro from $25/mo per project** + usage (storage, bandwidth, larger compute add-ons $10–$100+/mo) | Pro removes the pause and is the realistic production baseline. |
| **AI — text summaries** | Provider-dependent | Per your provider's per-token rate | Low volume = low cost; rule-based fallback means you can run at ₦0 if you choose not to use AI. |
| **AI — cover images** | Provider-dependent | Per your provider's per-image rate | One-off per vendor; bundled stock photos mean this can stay near zero. |
| **Email (Supabase)** | Included within plan limits | Overage / custom SMTP extra | Most early-stage usage is free. |
| **Google sign-in, WhatsApp links** | Free | Free | No per-use charge. |

### Payment processing (Nigeria) — fees on money you collect, not a fixed bill

| Provider | Local card fee | Cap | International | Other |
|----------|---------------|-----|---------------|-------|
| **Paystack** | **1.5% + ₦100** (₦100 waived under ₦2,500) | **₦2,000 max** | 3.9% + ₦100 | +7.5% VAT on the fee; chargeback ₦2,500; no monthly fee |
| **Flutterwave** | **1.4% + ₦100** | ₦2,000 max | 3.8% | Similar; no monthly fee |

Example: on a ₦100,000 brand subscription, the Paystack fee hits the ₦2,000 cap,
so ≈ ₦2,000 + 7.5% VAT ≈ **₦2,150** per payment.

> A **live version** is in the app: **Admin → Running costs** — editable rates +
> volumes, a live vendor count, the Naira payment-fee calculation, and a running
> monthly total. It's an estimate to sanity-check invoices, not a billing feed.

---

## 4. Production access (how logins work for real)

Three kinds of people, each with a real, secure way in. **No hard-coded backdoor
in production.**

- **Users** — email + password (with verification) or "Continue with Google."
- **Brands** — sign up as a user, complete brand onboarding (details → submit);
  once approved and subscribed, the brand dashboard unlocks.
- **Admins** — the **first** person claims the super-admin role once (bootstrap);
  after that the super-admin grants admin to others from **Admin → Roles**. No one
  can promote themselves.

**Google OAuth setup:** enable the Google provider in Supabase → Authentication →
Providers, and add your site URL + `…/dashboard` to the allowed redirect URLs.

**Demo / tester logins:** the sign-in page can show one-tap **User / Brand /
Admin** buttons for testing. They are **hidden in production** unless you set
`VITE_ENABLE_DEMO_LOGINS=true`, rely on the `ensure_demo_role` database function
(see `supabase/migrations`), and require email auto-confirm to be on in Supabase
Auth settings.

---

## 5. Going live (for staff)

The app ships **ready to run with nothing to connect**: it works on your Supabase
project as-is, AI features fall back to the built-in generator, and vendor cards
use the bundled photos. Connect AI/payment keys only when you want those extras.

**Recommended keys (optional, set in Supabase → Edge Functions → Secrets):**
- `AI_API_KEY` = your OpenAI key (primary, `gpt-4o-mini`)
- `AI_FALLBACK_KEY` = your Groq key (fast/cheap fallback)
- Leave image keys unset to keep free bundled covers.

**Switching from test data to real data (in Admin → Data mode):**
1. Staff load real vendors / catalog / cities through the admin (these save as
   **live** data).
2. Flip **Admin preview mode** to **Live** and check the site looks right.
3. Click **Approve & publish preview** so the public sees live data.
4. Pin anything you want to keep with **Retain**, then click **Promote retained → live**.
5. When testing is done, click **Purge unretained mock data** to permanently
   delete the seeded test rows. (Verified wired to the `purge_mock_data` function.)
6. Turn the **Tester sign-in** switch off (the one-tap logins are already hidden
   in the production build).

---

## 6. What it takes for an Apple App Store version

The app today is a website / installable web app (PWA). The App Store needs a
**native iOS app**, which is a separate (achievable) project:

1. **Wrap it natively** with Capacitor — it reuses this exact codebase inside a
   native shell, so you don't rebuild the app.
2. **Apple Developer account** — US$99/year.
3. **Meet the review guidelines.** The two that matter most here:
   - Apple rejects apps that are "just a website," so the iOS build needs native
     touches (push notifications, share sheet, offline, etc.).
   - **In-app purchases:** if brands pay their subscription *inside* the iOS app,
     Apple requires Apple's own IAP and takes **15–30%**. The common workaround is
     to keep paid sign-ups on the web and let the app be free to use.
   - Required: a privacy policy, in-app **account deletion**, and a privacy
     "nutrition label."
4. **Build, test on TestFlight, submit** — review typically takes a few days.

Rough effort: a couple of weeks for a solid first submission, most of it on the
native wrapper, IAP/payment decision, and the guideline checklist — not on
rebuilding features.
