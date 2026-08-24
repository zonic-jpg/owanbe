# Owanbe Planner — AWS Developer Deploy Guide

**Version:** 6.0.0  
**Date:** 2026-07-30  
**Stack:** Vite + React SPA, Supabase backend

---

## Prerequisites

1. **Apply database migrations first** (required before any deploy). See `docs/OWANBE-FIX-REPORT.pdf` or run `npx supabase db push` / `supabase/APPLY_ALL.sql`.
2. Node.js 18+ and npm.
3. AWS account with permissions for S3, CloudFront, or Amplify / App Runner.

---

## Environment variables (set before `npm run build`)

| Variable | Required | Notes |
|----------|----------|-------|
| VITE_SUPABASE_URL | Yes | `https://YOUR_REF.supabase.co` (must be https) |
| VITE_SUPABASE_PUBLISHABLE_KEY | Yes* | Anon/public key from Settings → API |
| VITE_SUPABASE_ANON_KEY | Yes* | Same value — alias used by some hosts |

\*Set **at least one** of the two key names. The client accepts both. Vite inlines these at **build** time.

Without these, login cannot reach Supabase. See `docs/OWANBE-LOGIN-FETCH-FIX.md`.

Example `.env` (do not commit secrets):

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Build (local or CI)

```bash
cd owanbe-6
npm install
npm run build
```

Output: `dist/` (static assets). Verify exit code 0 before upload.

---

## Option A — S3 + CloudFront (recommended static SPA)

1. Create an S3 bucket (block public access; use OAI/OAC with CloudFront).
2. Upload contents of `dist/` (`aws s3 sync dist/ s3://YOUR_BUCKET/ --delete`).
3. Create CloudFront distribution with S3 origin.
4. **SPA routing:** Custom error responses — map **403** and **404** to `/index.html` with response code **200**.
5. Invalidate cache after deploy: `aws cloudfront create-invalidation --distribution-id ID --paths "/*"`.

---

## Option B — AWS Amplify Hosting

1. Connect GitHub repo or upload artifact.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add environment variables in Amplify console (same `VITE_*` keys).
5. Apply Supabase migrations **before** pointing users at the new URL.

---

## Option C — AWS App Runner (container serving static)

For a small Node static server image:

1. Build `dist/` in CI with env vars injected.
2. Serve with `nginx` or `serve` in Dockerfile; push to ECR.
3. App Runner service from image; set port 80/8080.

Most teams use **Option A or B** for this Vite SPA.

---

## Deploy checklist

1. Migrations applied (`events`, `brands`, roles — verify in Supabase).
2. `npm run build` succeeds with production env vars.
3. Upload `dist/` to hosting.
4. SPA fallback configured (CloudFront or Amplify).
5. Smoke test: login, `/dashboard` loads events, `/admin` for super admin.

---

## Troubleshooting

- **Schema cache / missing table errors:** Migrations not applied — run `supabase db push` or `APPLY_ALL.sql`.
- **Blank API / “Cannot reach …supabase.co”:** Wrong or missing `VITE_SUPABASE_*` at build time, paused project, or HTTP API on an HTTPS site — rebuild after fixing env. See `docs/OWANBE-LOGIN-FETCH-FIX.md`.
- **404 on refresh:** Missing SPA rewrite to `index.html`.
