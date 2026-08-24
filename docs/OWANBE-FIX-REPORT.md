# Owanbe Planner — fix report

**Project:** `/Users/olufemiadeagbo/Downloads/owanbe-6`  
**Date:** 2026-07-30

## Summary

Four issues were addressed: missing Supabase tables (schema cache), super-admin claim
flow, reviewer-wide admin access, and auto super-admin for the founding owner.

---

## Fix 1 — Schema cache errors (`event`, `brand`)

**Root cause:** Migrations were not applied to the linked Supabase project. The app
correctly uses `events` and `brands` (plural); there were no singular table
references in client code.

**Changes:**
- Added consolidated migration `supabase/migrations/20260730170000_schema_access_fix.sql`
- Added `supabase/APPLY_ALL.sql` (dashboard-ready copy of the fix)
- Added `docs/SCHEMA_APPLY.md` with `supabase db push` instructions

**Action required:** Run SQL in Supabase (see below).

---

## Fix 2 — Super admin claim

**Root cause:** `claim_super_admin()` was restricted to `oadeagbo@gmail.com` but the
UI still showed a generic “first user” bootstrap card. `refreshRoles` also passed
the wrong argument type to the session sync helper.

**Changes:**
- `src/pages/Admin.tsx` — shows `ClaimSuperAdminCard` for founding owner when not yet super admin
- `src/pages/Dashboard.tsx` — claim card limited to `isFoundingOwner`
- `src/components/ClaimSuperAdminCard.tsx` — founding-owner copy and error messages
- `src/contexts/AuthContext.tsx` — fixed `refreshRoles` to pass `Session`; fallback to `claim_super_admin`

---

## Fix 3 — Reviewers as admins by default

**Changes (migration):**
- `grant_reviewer_admin()` — grants `admin`, `view_financials`, `grant_waivers`
- `grant_owner_super_admin` trigger on `auth.users` — non-founding signups get reviewer admin
- Backfill for existing users

---

## Fix 4 — `oadeagbo@gmail.com` auto super-admin

**Changes:**
- `src/lib/foundingOwner.ts` — `FOUNDING_OWNER_EMAIL` constant
- `src/lib/sessionAccess.ts` — wraps `ensure_session_access()` RPC
- `src/contexts/AuthContext.tsx` — calls `ensure_session_access` on every auth state change
- Migration seeds super_admin for founding email + trigger on signup/email update

---

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260730170000_schema_access_fix.sql` | Consolidated schema + access fix |
| `supabase/APPLY_ALL.sql` | Dashboard SQL (copy of fix migration) |
| `docs/SCHEMA_APPLY.md` | Apply instructions |
| `docs/OWANBE-FIX-REPORT.md` | This report |
| `src/lib/foundingOwner.ts` | Founding owner email helper |
| `src/lib/sessionAccess.ts` | Session access RPC wrapper |
| `src/contexts/AuthContext.tsx` | Auto access sync on login |
| `src/pages/Admin.tsx` | Super-admin claim in admin panel |
| `src/pages/Dashboard.tsx` | Founding-owner-only claim card |
| `src/components/ClaimSuperAdminCard.tsx` | Founding-owner messaging |

---

## SQL to run in Supabase dashboard

**Option A — full migration chain (CLI):**

```bash
cd /Users/olufemiadeagbo/Downloads/owanbe-6
npx supabase db push
```

**Option B — SQL Editor only:**

Paste and run the contents of `supabase/APPLY_ALL.sql`.

**Option C — fix only (base schema already applied):**

Paste and run `supabase/migrations/20260730170000_schema_access_fix.sql`.

---

## Post-apply checklist

1. Confirm tables: `events`, `brands`, `user_roles`, `admin_permissions`
2. Sign out / sign in as `oadeagbo@gmail.com`
3. Open `/admin` — Roles, Admin perms, Payment gates tabs visible
4. Open `/dashboard` — events load without schema cache errors

---

## Build

```bash
cd /Users/olufemiadeagbo/Downloads/owanbe-6
npm run build
```
