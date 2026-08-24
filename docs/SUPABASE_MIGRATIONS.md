# Supabase migrations — Owanbe Planner (OwnablePlanner)

## Root cause of schema cache errors

The app queries **`public.events`** and **`public.brands`** (plural). Errors like
`could not find the table public.event` / `public.brand` mean the linked Supabase
project has **not had migrations applied** (or PostgREST schema cache is stale).

There are **27 migration files** under `supabase/migrations/`. All must be applied
to project `kpfzdvzjokdqaqrafffn` (see `.env`).

## Apply migrations

### Option A — Supabase CLI (recommended)

```bash
cd /Users/olufemiadeagbo/Downloads/owanbe-6
npx supabase login
npx supabase link --project-ref kpfzdvzjokdqaqrafffn
npx supabase db push
```

### Option B — SQL Editor (dashboard)

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/kpfzdvzjokdqaqrafffn/sql/new).
2. Run each file in `supabase/migrations/` **in filename order** (oldest first).
3. Finish with `20260730170000_schema_access_fix.sql` (reloads schema cache).

### Option C — Apply only the latest fix (if base schema already exists)

If earlier migrations are already applied but access control is broken, run only:

`supabase/migrations/20260730170000_schema_access_fix.sql`

## Verify

After applying, confirm tables exist:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('events', 'brands', 'user_roles', 'admin_permissions');
```

Reload schema cache manually if needed:

```sql
notify pgrst, 'reload schema';
```

## Access control (included in latest migration)

| Feature | Behaviour |
|--------|-----------|
| Founding owner | `oadeagbo@gmail.com` gets `super_admin` on signup and every login |
| Reviewers / testers | Every authenticated user gets `admin` + `view_financials` + `grant_waivers` |
| Claim super admin | `claim_super_admin()` RPC — founding owner only |
| Auto on login | `ensure_session_access()` RPC — called from `AuthContext` |

## Revert tester-wide admin (production)

When testing ends, edit the commented block at the bottom of
`20260707160000_owner_super_admin_binding.sql` and run it in SQL Editor to remove
blanket `admin` grants while keeping the founding owner.
