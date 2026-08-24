# Apply Supabase schema — Owanbe Planner

## Problem

Errors like `could not find the table public.event` or `public.brand` mean PostgREST
cannot see the tables the app expects. The client uses **plural** names:
`events`, `brands`. Those tables come from `supabase/migrations/`.

## Recommended: `supabase db push`

```bash
cd /Users/olufemiadeagbo/Downloads/owanbe-6
npm install   # if needed
npx supabase login
npx supabase link --project-ref kpfzdvzjokdqaqrafffn
npx supabase db push
```

This applies all 27 migration files in order, including the consolidated fix
`20260730170000_schema_access_fix.sql`.

## Dashboard fallback

If you cannot use the CLI:

1. Open [SQL Editor](https://supabase.com/dashboard/project/kpfzdvzjokdqaqrafffn/sql/new).
2. Run every file in `supabase/migrations/` **oldest → newest** (by filename).
3. Or, if the base schema already exists, run only `supabase/APPLY_ALL.sql`.

## Verify

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('events', 'brands', 'user_roles', 'admin_permissions');

notify pgrst, 'reload schema';
```

## After apply

- Sign out and sign back in — `AuthContext` calls `ensure_session_access()` **after** the session exists (failure cannot block login).
- Founding owner (`oadeagbo@gmail.com`) receives `super_admin` automatically.
- All reviewers/testers receive `admin` + full admin permissions.

## Auth URLs (login “Failed to fetch” / Google)

1. Confirm the project is **not paused** (Dashboard home → Restore if needed).
2. **Authentication → URL Configuration**
   - Site URL = hosted origin (`https://….up.railway.app` or CloudFront).
   - Redirect URLs include that origin plus `http://localhost:8080/**`.
3. Frontend build vars: `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`.

See `docs/OWANBE-LOGIN-FETCH-FIX.md`.

See also: `docs/OWANBE-FIX-REPORT.md`, `docs/SUPABASE_MIGRATIONS.md`.
