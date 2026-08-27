# OwanbeX auth — Zonic orbit standard (5 rules)

See MyYangaX `AUTH.md` for the full orbit standard.

## Rule 1 — Owner always in

`oadeagbo@gmail.com` → founding owner + super_admin immediately. Never pending.

## Rule 2 — ADMINTESTER queue

Any other email + admin password → **PENDING** with awaiting-approval message.

## Rule 3 — Owner queue on login

Owner login → `/admin#admintester-queue`.

## Rule 4 — Approved = full access

Approved testers receive super_admin + full admin permissions.

## Rule 5 — Owner allocates rights

Owner manages roles, payment gates, and admin perms in Admin panel.

## Module

`src/lib/adminTesterApproval.ts` · local stand-in: `src/lib/localBackend.ts`
