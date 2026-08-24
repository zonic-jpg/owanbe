# Owanbe Planner — Railway Staging Guide

**Version:** 6.0.0  
**Date:** 2026-07-30

---

## Overview

Railway hosts the **built static site** or a **static file server** for staging. Supabase remains the database — link the same project and **apply migrations before** the first staging deploy.

---

## 1. Supabase (do this first)

```bash
cd owanbe-6
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or run `supabase/APPLY_ALL.sql` in the Supabase SQL Editor.

Verify tables: `events`, `brands`, `user_roles`, `admin_permissions`.

---

## 2. Connect repository

1. [Railway](https://railway.app) → New Project → Deploy from GitHub repo (`owanbe-6`).
2. Select branch used for staging (e.g. `main` or `staging`).

---

## 3. Environment variables

In Railway → Service → Variables, set (for build):

| Variable | Value |
|----------|-------|
| VITE_SUPABASE_URL | `https://YOUR_REF.supabase.co` |
| VITE_SUPABASE_PUBLISHABLE_KEY | Anon public key (Settings → API) |
| VITE_SUPABASE_ANON_KEY | Same anon key (alias; either name is enough) |
| NODE_VERSION | 20 (optional) |

Add any other `VITE_*` keys your app expects. Rebuild after changing these — they are compile-time. See `docs/OWANBE-LOGIN-FETCH-FIX.md`.

---

## 4. Build and start commands

**Static SPA (recommended):**

- **Build command:** `npm install && npm run build`
- **Start command:** `npx serve dist -s -l $PORT`  
  (`-s` enables SPA fallback to `index.html`)

Add `serve` to `package.json` dependencies or use `npx serve` as above.

**Alternative:** Railway **Static Site** template if available — build `npm run build`, publish `dist/`.

---

## 5. Custom domain (optional)

Railway → Settings → Generate domain or attach custom domain. Rebuild after env changes.

---

## 6. Post-deploy verification

1. Open staging URL — landing page loads.
2. Sign in as `oadeagbo@gmail.com` — super admin / admin tabs on `/admin`.
3. `/dashboard` — no `public.event` / `public.brand` schema errors (plural tables `events`, `brands`).
4. New reviewer signups receive admin permissions (migration behavior).

---

## 7. Redeploy workflow

1. Push code to connected branch.
2. Railway rebuilds automatically.
3. If only SQL changed, run migrations in Supabase — no Railway rebuild required.

---

## Related docs

- `docs/OWANBE-FIX-REPORT.pdf` — root cause and fixes
- `docs/AWS_DEPLOY_GUIDE.pdf` — production AWS path
- `supabase/migrations/` — full migration chain
