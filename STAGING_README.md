# OwanbeX v1.0.0 — Staging

Unzip, then:

```bash
cd owanbe-6   # or the folder this zip extracted to
cp .env.example .env   # paste Supabase URL + anon key if you have them
npm install
npm run dev            # http://localhost:8080
```

**Tester login:** `/auth` → User / Brand / Admin (password `test1111`)  
Founding owner: `oadeagbo@gmail.com` / `test1111` (super admin).

If the hosted site cannot reach Supabase, set both:

```
VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon jwt>
VITE_SUPABASE_ANON_KEY=<same anon jwt>
```

then `npm run build` and redeploy. See `docs/OWANBE-LOGIN-FETCH-FIX.md` and `docs/OWANBEX-VERSION-FIX-LOG.md`.
