# Owanbe — AWS staging (verified build ✓)

Vite + React SPA. Build verified in-house: `npm install && npm run build` → exit 0, `dist/` produced.

## Stage on AWS (static SPA)
1. `npm install`
2. `npm run build`  → outputs to `dist/`  (a prebuilt `dist/` is already included)
3. **S3 + CloudFront**: upload `dist/` to an S3 bucket; put CloudFront in front.
   - CloudFront → Error pages → map 403 and 404 to `/index.html` (200) so client-side routes work.
   - Or use **AWS Amplify Hosting**: connect repo, build command `npm run build`, output dir `dist`.
## Env (set before build for live Supabase)
VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY **or** VITE_SUPABASE_ANON_KEY
(both key names work; set both to the same anon public JWT). See `docs/OWANBE-LOGIN-FETCH-FIX.md`.
