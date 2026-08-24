# Owanbe Planner — login “Failed to fetch” fix

**Project:** `/Users/olufemiadeagbo/Downloads/owanbe-6`  
**Date:** 2026-08-14  
**Package:** `~/Downloads/owanbe-v7.zip`

---

## Root cause (honest split)

Testers see **Failed to fetch** because the browser never completed an HTTP call to Supabase Auth (`POST /auth/v1/token`). That is **not** a wrong-password error.

Two things were true at once:

### 1. Hosting / env (primary — not a password bug)

Vite **bakes** `VITE_*` into the JS bundle at `npm run build`. The client only read:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

AWS / Railway docs told operators to set **`VITE_SUPABASE_ANON_KEY`**. A hosted rebuild that followed those docs produced a client with an empty key / wrong wiring. Combined with a missing `.env` on unzip (zip never includes `.env`), login `fetch()` goes nowhere.

The linked project is:

`https://kpfzdvzjokdqaqrafffn.supabase.co`

If that project is **paused**, DNS-dead, or the hosted origin is blocked, the same browser error appears even when keys are correct. Password login does **not** need extra CORS headers on supabase.co, but **Site URL / Redirect URLs** must include the Railway/AWS origin for Google OAuth.

### 2. Code bugs that made it look like an app crash

- `mapAuthError` only treated `TypeError`. supabase-js wraps network failures as `AuthRetryableFetchError` with message `"Failed to fetch"` and returned that **raw string** on the form.
- Demo / Google / resend paths toasted `error.message` unchanged.
- `ensure_session_access()` and `user_roles` ran after login with no timeout/catch. Missing RPC/tables could hang or throw after a successful session.
- Deploy docs used a different env name than the client.

Login itself (`signInWithPassword`) never required `events` / `brands`. Those tables matter **after** you are in.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/supabaseEnv.ts` | Resolve URL + **both** key names; diagnose mixed content / missing env |
| `src/lib/authErrors.ts` | Actionable login errors; never show raw “Failed to fetch” |
| `src/lib/authErrors.test.ts` | Unit tests for env alias + error copy |
| `src/integrations/supabase/client.ts` | Use resolver; 15s fetch timeout; do not crash the app if env is empty |
| `src/contexts/AuthContext.tsx` | Session is established first; RPC/roles cannot block or throw |
| `src/lib/sessionAccess.ts` | 8s timeout; never throws |
| `src/pages/Auth.tsx` | Config banner; mapped errors on email, demo, Google, resend |
| `src/hooks/useLandingContent.ts` | Keep landing defaults if CMS fetch fails |
| `src/vite-env.d.ts` | Document `VITE_SUPABASE_ANON_KEY` |
| `.env.example` | Both key names |
| `.env` | Added `VITE_SUPABASE_ANON_KEY` alias (local only; not in zip) |
| `docs/AWS_DEPLOY_GUIDE.md` | Correct env names |
| `docs/RAILWAY_STAGING_GUIDE.md` | Correct env names |
| `DEPLOY_AWS.md` | Correct env names |
| `docs/SCHEMA_APPLY.md` | Auth URL config + pause restore |
| `package.json` / `VERSION` | 7.0.0 |
| `scripts/package-v7.mjs` | Builds `~/Downloads/owanbe-v7.zip` |

---

## What testers should do (login)

1. Open the hosted URL (Railway/AWS) **or** local `npm run dev` → **Sign in**.
2. Create an account on the **Create account** tab (email + password ≥ 6 chars), then sign in.
3. Founding owner: `oadeagbo@gmail.com` (must already exist in that Supabase project).
4. Local / `VITE_ENABLE_DEMO_LOGINS=true` only: User / Brand / Admin one-tap buttons (`user@demo.local` / password `test1111`).
5. You should see a **credential** error if the password is wrong — not a network paragraph. If you still see “Cannot reach …supabase.co”, the **project or env** is the problem (next section).

---

## Exact Supabase dashboard steps (AWS / testers)

Project ref: **`kpfzdvzjokdqaqrafffn`**

### A. Confirm the project is alive

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/kpfzdvzjokdqaqrafffn).
2. If you see **Project paused**, click **Restore**. Wait until the project is healthy.
3. **Settings → API**:
   - **Project URL** must be `https://kpfzdvzjokdqaqrafffn.supabase.co` (https, not http).
   - Copy **anon public** key into **both** `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY`.
4. Rebuild the frontend after changing env vars (`npm run build` or Railway/Amplify redeploy). Vite does not read runtime env on the server.

### B. Allow the hosted origin (needed for Google; harmless for password)

1. **Authentication → URL Configuration**.
2. **Site URL** = the exact tester origin, e.g. `https://YOUR-APP.up.railway.app` or the CloudFront URL.
3. **Redirect URLs** add:
   - `http://localhost:8080/**`
   - `https://YOUR-APP.up.railway.app/**`
   - `https://YOUR-CLOUDFRONT-DOMAIN/**`
4. **Authentication → Providers → Email**: enable Email. Turn **Confirm email** off for staging testers, or they must use the resend-verification link.

### C. Apply schema (after login works; needed for dashboard)

SQL Editor → paste and run `supabase/APPLY_ALL.sql`  
**or** CLI:

```bash
npx supabase login
npx supabase link --project-ref kpfzdvzjokdqaqrafffn
npx supabase db push
```

Then:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('events', 'brands', 'user_roles', 'admin_permissions');

notify pgrst, 'reload schema';
```

Founding owner `oadeagbo@gmail.com` is granted `super_admin` by `ensure_session_access()` after a successful login (once the SQL is applied).

---

## Host env vars (set BEFORE build)

```bash
VITE_SUPABASE_URL=https://kpfzdvzjokdqaqrafffn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon public JWT>
VITE_SUPABASE_ANON_KEY=<same anon public JWT>
```

Either key name is enough. Setting both is safest.

---

## Local verify

```bash
cd owanbe-6
cp .env.example .env   # then paste real URL + anon key
npm install
npm test               # includes authErrors tests
npm run dev            # http://localhost:8080 → /auth
```
