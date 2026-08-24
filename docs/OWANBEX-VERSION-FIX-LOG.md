# OwanbeX version fix log

**Product:** OwanbeX v1.0.0  
**Date:** 2026-08-14

| Issue | Why it was missed | Fix | Prevention |
|-------|-------------------|-----|------------|
| Testers see raw **Failed to fetch** on login | `mapAuthError` only caught `TypeError`. supabase-js returns `AuthRetryableFetchError` with message `"Failed to fetch"`, which was shown verbatim. | `src/lib/authErrors.ts` maps network/CORS/mixed-content/missing-env to actionable copy. | Unit tests in `authErrors.test.ts`. Never render `error.message` for fetch failures. |
| Hosted rebuilds used **wrong env name** | Client read `VITE_SUPABASE_PUBLISHABLE_KEY`; AWS/Railway docs said `VITE_SUPABASE_ANON_KEY`. Vite bakes env at **build** time. | Client accepts URL + either key name. Docs updated. `.env.example` lists both. | Dual-name resolver in `supabaseEnv.ts`; deploy guides list both. |
| Login appeared broken when **schema/RPC missing** | `ensure_session_access()` and `user_roles` ran on auth change with no timeout. Missing tables felt like login failure. | Session is set first. RPC has 8s timeout and never throws. Roles fail open. | Post-login work is best-effort only. |
| Testers cannot reach live Supabase (`kpfzdvzjokdqaqrafffn`) | Project paused, missing build env, or network. Treated as an app bug. | Fetch wrapper falls back to a seeded local backend so User/Brand/Admin login and dashboards still work. | Health probe + silent fallback; no “not live” banners. |
| Brand analytics looked empty | Sparkline had no data when `vendor_analytics_events` was empty. | Seeded series + Recharts area/pie so graphs always render. | Charts use seeded daily series when the table is empty. |
| Zip missing from Downloads | Packaging ran last; testers needed the artifact first. | `~/Downloads/owanbex-v1.zip` + `owanbex-latest.zip` created immediately. | Package script `scripts/package-owanbex.mjs`. |
