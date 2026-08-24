# Catalog, Selection & Analytics — Full Build

## What you'll get

1. A real catalog of products in every service category (champagnes, bouquets, cake tiers, DJ packages, MUA looks, photo packages, venues, aso-ebi fabrics, souvenirs, etc.) with images, descriptions, and unit prices.
2. A browse-and-pick flow inside each event: open a category → see options → view product detail → pick one. The event's running total updates live.
3. A "Top 3 picks" comparison table per category (cost, rating, fit-for-budget, AI "why this one") that helps the user decide.
4. A live event summary table: every category, chosen product, unit price × qty, subtotal, **total cost**, **average per category**, % of budget used.
5. Analytics dashboards:
   - **User**: spend breakdown by category, % of budget used, comparison vs similar Lagos 250-guest events, AI summary + 3 cost-saving swap suggestions.
   - **Brand**: views, clicks, shortlists, conversion per product, revenue attributed, trending categories, weekly AI written summary.
6. AI summaries powered by the Lovable AI gateway (no extra keys needed).

## Build order (single shipment)

### Stage A — Schema & seed data
- New table `catalog_products`: vendor_id, category, name, description, unit_label (per guest / per bottle / per arrangement / flat), unit_price, image_url, rating, is_featured, attributes (jsonb for things like champagne brand, sweetness, bouquet style), is_active.
- New table `event_selections`: event_id, category, product_id, qty, locked_unit_price, position. One selection per (event, category) — enforces the "pick one" model.
- New table `product_analytics_events`: product_id, event_type (view/click/shortlist/select), user_id, session_id, created_at. Mirrors vendor_analytics_events but per product.
- RLS: catalog public-readable when active; selections owner-only; analytics insert public, read by product's brand or admin.
- Seed: AI-generate ~8 products per category for Lagos with realistic NGN unit prices and AI-generated cover images (Nano Banana). Stored permanently — admins can edit/add/remove.

### Stage B — Admin
- New `CatalogAdmin.tsx` panel under /admin: list, search by category, create/edit/delete, CSV import, toggle featured/active. Mirrors `PricingAdmin` and `VendorsAdmin` patterns.

### Stage C — User flow (inside EventDetail)
- Replace the legacy "Tiers" section with a **Categories grid**: 13 cards (one per service), each shows chosen product (or "Pick one") and subtotal.
- Click a card → `CategoryPicker` drawer/page: shows the **Top 3 comparison table** at the top, full grid of options below, filter by price band and attributes.
- Click any product → `ProductDetail` modal: gallery, full description, attributes, rating, reviews, "Choose this" button.
- "Choose this" writes to `event_selections` with locked unit price and qty (auto-derived from event guest_count and unit_label, user-editable).
- Live **Event Summary Table**: sticky footer card with Category | Pick | Unit | Qty | Subtotal columns, Total + Average row.
- Honors `budget_mode`: in *fixed* mode, shows red over-budget badges and AI rebalance suggestion; in *open* mode, just totals.

### Stage D — Analytics + AI
- New `/analytics` route for user, accessible from EventDetail: Recharts pie + bar of spend by category, KPI tiles (total, avg/category, % budget), benchmark vs similar events (computed from other events' aggregates in same city/guest-band), AI summary block.
- Brand dashboard gets a new "Catalog performance" tab: per-product funnel (views → clicks → shortlists → selections → revenue), trending categories, AI weekly summary.
- AI summaries: edge function `event-ai-summary` and `brand-ai-summary` calling `google/gemini-2.5-flash` via the Lovable AI gateway. Cached on the row, refresh button to regenerate.
- Tracking helpers fire `view`, `click`, `shortlist`, `select` events into `product_analytics_events` from the picker and detail views.

## Technical notes

- Images: AI-generated once during seed via the Nano Banana model, uploaded to a new public storage bucket `catalog-images`. URLs stored on `catalog_products.image_url`.
- The "average cost" shown to the user = Σ subtotals ÷ count of categories with a pick.
- Benchmark vs similar events uses a SQL view that aggregates totals by (city, guest_band) over `event_selections`.
- Edge functions: `seed-catalog` (admin-only, idempotent), `event-ai-summary`, `brand-ai-summary`. All use `LOVABLE_API_KEY` (already set), no user-supplied keys.
- Existing tier code stays in the codebase but is no longer the primary surface — EventDetail switches to the new categories grid. Sample-event helper retired.

## Approximate touch list

```text
supabase/migrations/<new>.sql          # tables, RLS, view
supabase/functions/seed-catalog/       # AI-seeds products + images
supabase/functions/event-ai-summary/   # per-event AI summary
supabase/functions/brand-ai-summary/   # per-brand AI summary
src/pages/EventDetail.tsx              # categories grid + summary table
src/pages/CategoryPicker.tsx           # top-3 + grid + filters
src/pages/ProductDetail.tsx            # detail modal
src/pages/EventAnalytics.tsx           # user analytics
src/pages/BrandDashboard.tsx           # + catalog performance tab
src/components/admin/CatalogAdmin.tsx  # admin CRUD
src/components/EventSummaryTable.tsx
src/lib/catalog-track.ts
```

## Out of scope for this pass

- Real payment to vendors for selections (selections are plans, not orders).
- Multi-item selections per category (locked to "pick one" per your answer; can extend later).
- Real-time co-editing.

Approve and I'll start with Stage A and roll straight through to D.
