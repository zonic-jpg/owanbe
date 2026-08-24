// AI summary for a brand: catalog performance + recommendations.
// Uses a configurable AI provider (see ../_shared/ai.ts) with a rule-based
// fallback so it degrades gracefully instead of returning a 502.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiConfigured, aiJson } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const naira = (n: number) => "₦" + Math.round(n).toLocaleString();

interface ProductStat {
  name: string; category: string; unit_price: number;
  view: number; click: number; shortlist: number; select: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { brand_id } = await req.json();
    if (!brand_id) return new Response(JSON.stringify({ error: "brand_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: brand } = await userClient.from("brands").select("name").eq("id", brand_id).maybeSingle();
    if (!brand) return new Response(JSON.stringify({ error: "Brand not found or no access" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: vendorIds } = await admin.from("brand_vendors").select("vendor_id").eq("brand_id", brand_id);
    const vIds = (vendorIds ?? []).map((r: { vendor_id: string }) => r.vendor_id);
    const { data: products } = vIds.length
      ? await admin.from("catalog_products").select("id, name, category, unit_price").in("vendor_id", vIds)
      : { data: [] as Array<Record<string, unknown>> };
    const pIds = (products ?? []).map((p: { id: string }) => p.id);
    const { data: events } = pIds.length
      ? await admin.from("product_analytics_events").select("product_id, event_type").in("product_id", pIds)
      : { data: [] as Array<Record<string, unknown>> };

    const stats: Record<string, ProductStat> = {};
    for (const p of products ?? []) stats[p.id] = { name: p.name, category: p.category, unit_price: p.unit_price, view: 0, click: 0, shortlist: 0, select: 0 };
    for (const e of events ?? []) if (stats[e.product_id]) stats[e.product_id][e.event_type]++;

    const { data: selections } = pIds.length
      ? await admin.from("event_selections").select("product_id, qty, locked_unit_price").in("product_id", pIds)
      : { data: [] as Array<Record<string, unknown>> };
    let revenue = 0;
    for (const s of selections ?? []) revenue += s.qty * s.locked_unit_price;

    const statList = Object.values(stats) as ProductStat[];
    const summaryRows = statList
      .map((s: ProductStat) => `- ${s.name} (${s.category}): ${s.view} views, ${s.click} clicks, ${s.shortlist} shortlists, ${s.select} selections at ${naira(s.unit_price)}`)
      .join("\n");

    let parsed: { summary: string; suggestions: string[] };

    if (aiConfigured()) {
      try {
        const prompt = `You are a marketplace analyst advising a Nigerian event vendor brand. Reply with valid JSON only.

Brand: ${brand.name}
Total catalog products: ${products?.length ?? 0}
Total attributed revenue from selections so far: ${naira(revenue)}

Per-product funnel:
${summaryRows || "(no products yet)"}

Reply ONLY with valid JSON:
{
  "summary": "3-4 sentences: what's working, what's not, key trend.",
  "suggestions": [
    {"title":"Short action","detail":"Why and how to do it"}
  ]
}
Provide exactly 3 suggestions. No markdown, no preamble.`;
        const ai = await aiJson(prompt);
        parsed = { summary: ai.summary ?? "", suggestions: Array.isArray(ai.suggestions) ? ai.suggestions : [] };
      } catch (_) {
        parsed = ruleBased(brand.name, statList, products?.length ?? 0, revenue);
      }
    } else {
      parsed = ruleBased(brand.name, statList, products?.length ?? 0, revenue);
    }

    await admin.from("ai_summaries").upsert({
      scope: "brand",
      ref_id: brand_id,
      summary: parsed.summary,
      suggestions: parsed.suggestions,
      generated_at: new Date().toISOString(),
    }, { onConflict: "scope,ref_id" });

    return new Response(JSON.stringify({ ok: true, ...parsed, revenue, products: products?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as { message?: string })?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function ruleBased(name: string, stats: ProductStat[], productCount: number, revenue: number): { summary: string; suggestions: string[] } {
  if (stats.length === 0) {
    return {
      summary: `${name} has no catalog products yet, so there's nothing to analyse. Add your first few products with clear photos and prices to start appearing in the directory.`,
      suggestions: [
        { title: "Add your first products", detail: "List 3–5 products with sharp photos and honest prices — listings with images get far more clicks." },
        { title: "Complete your profile", detail: "A filled-out bio, city and contact details build trust and improve your ranking." },
        { title: "Pick the right categories", detail: "Tag each product to the most specific category so the right planners find you." },
      ],
    };
  }
  const byClicks = [...stats].sort((a, b) => b.click - a.click);
  const best = byClicks[0];
  const worst = byClicks[byClicks.length - 1];
  const totalSelect = stats.reduce((s, x) => s + x.select, 0);
  return {
    summary: `${name} has ${productCount} product${productCount === 1 ? "" : "s"} and ${naira(revenue)} attributed so far. "${best.name}" is your strongest listing on clicks; "${worst.name}" is getting the least attention. ${totalSelect === 0 ? "Nothing has been selected into an event yet — focus on converting interest." : `${totalSelect} selection${totalSelect === 1 ? "" : "s"} recorded.`}`,
    suggestions: [
      { title: `Promote "${best.name}"`, detail: "It already draws the most clicks — feature it first and make sure its price and photo are your best." },
      { title: `Refresh "${worst.name}"`, detail: "Your quietest listing likely needs a clearer photo, a sharper title, or a more competitive price." },
      { title: "Tighten pricing on slow movers", detail: "Products with views but no selections are usually priced or presented just above the line — small adjustments convert." },
    ],
  };
}
