// Verifies that the seed-catalog source ships ≥5 products per category, each
// with a populated image and a positive NGN unit price. If the live database
// credentials are present in the environment, also verifies that the seeded
// catalog_products table reflects the same invariants — i.e. running
// Admin → Catalog → Seed / refresh catalog will populate every category with
// at least 5 priced + imaged products.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CATALOG } from "./index.ts";

Deno.test("seed source: every category has ≥5 products with images and NGN prices", () => {
  const categories = Object.keys(CATALOG);
  assert(categories.length > 0, "CATALOG must define at least one category");

  const violations: string[] = [];
  for (const [cat, products] of Object.entries(CATALOG)) {
    if (products.length < 5) {
      violations.push(`${cat}: only ${products.length} products (need ≥5)`);
      continue;
    }
    for (const p of products) {
      if (!p.image_keyword || typeof p.image_keyword !== "string") {
        violations.push(`${cat} > "${p.name}": missing image_keyword`);
      }
      if (!Number.isInteger(p.unit_price) || p.unit_price <= 0) {
        violations.push(`${cat} > "${p.name}": invalid NGN unit_price (${p.unit_price})`);
      }
      if (!p.unit_label) {
        violations.push(`${cat} > "${p.name}": missing unit_label`);
      }
    }
  }
  assertEquals(violations, [], `Seed catalog issues:\n  - ${violations.join("\n  - ")}`);
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.test({
  name: "live DB: every seeded category has ≥5 products with image_url + unit_price",
  ignore: !SUPABASE_URL || !SERVICE_KEY,
  fn: async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE_KEY!);
    const { data, error } = await admin
      .from("catalog_products")
      .select("category, name, image_url, unit_price, is_active")
      .eq("is_active", true);
    if (error) throw error;

    const grouped = new Map<string, { name: string; image_url: string | null; unit_price: number }[]>();
    for (const r of data ?? []) {
      const list = grouped.get(r.category) ?? [];
      list.push({ name: r.name, image_url: r.image_url, unit_price: r.unit_price });
      grouped.set(r.category, list);
    }

    const violations: string[] = [];
    for (const cat of Object.keys(CATALOG)) {
      const rows = grouped.get(cat) ?? [];
      if (rows.length < 5) {
        violations.push(`${cat}: only ${rows.length} active products in DB (need ≥5). Run Admin → Catalog → Seed.`);
        continue;
      }
      for (const r of rows) {
        if (!r.image_url) violations.push(`${cat} > "${r.name}": missing image_url in DB`);
        if (!r.unit_price || r.unit_price <= 0) violations.push(`${cat} > "${r.name}": missing/invalid unit_price in DB`);
      }
    }
    assertEquals(violations, [], `Catalog DB issues:\n  - ${violations.join("\n  - ")}`);
  },
});
