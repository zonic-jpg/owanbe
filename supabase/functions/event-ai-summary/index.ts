// AI summary for an event: spend breakdown + 3 cost-saving suggestions.
// Uses a configurable AI provider (see ../_shared/ai.ts). If AI is not
// configured or fails, returns a deterministic rule-based summary instead of
// erroring — the feature degrades, it never breaks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiConfigured, aiJson } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const naira = (n: number) => "₦" + Math.round(n).toLocaleString();

interface SelectionRow {
  category: string; qty: number; locked_unit_price: number;
  catalog_products?: { name?: string } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { event_id } = await req.json();
    if (!event_id) return new Response(JSON.stringify({ error: "event_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: ev } = await userClient.from("events").select("name, type, city, guest_count, budget_mode, budget_min, budget_max, vibe").eq("id", event_id).maybeSingle();
    if (!ev) return new Response(JSON.stringify({ error: "Event not found or no access" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: sel } = await userClient.from("event_selections").select("category, qty, locked_unit_price, catalog_products(name, unit_label, attributes)").eq("event_id", event_id);

    const rows = sel ?? [];
    const total = rows.reduce((s: number, r: SelectionRow) => s + r.qty * r.locked_unit_price, 0);
    const lines = rows.map((r: SelectionRow) => `- ${r.category}: ${r.catalog_products?.name} — ${r.qty} × ${naira(r.locked_unit_price)} = ${naira(r.qty * r.locked_unit_price)}`).join("\n");

    let parsed: { summary: string; suggestions: string[] };

    if (aiConfigured()) {
      try {
        const prompt = `You are a Nigerian event-planning expert. Analyse this Owanbe event plan and reply with JSON only.

Event: ${ev.name} (${ev.type}) in ${ev.city} for ${ev.guest_count} guests.
Vibe: ${ev.vibe ?? "—"}.
Budget mode: ${ev.budget_mode ?? "open"}. Budget range: ${naira(ev.budget_min ?? 0)} – ${naira(ev.budget_max ?? 0)}.
Selections (${rows.length}):
${lines || "(no selections yet)"}
Total so far: ${naira(total)}.

Reply ONLY with valid JSON in this shape:
{
  "summary": "2-3 sentence summary of the plan, tone, and how it tracks vs budget. Reference Lagos market norms.",
  "suggestions": [
    {"category":"<category>","title":"Short title","detail":"How and why this swap saves money or improves the day.","est_savings_ngn": 0}
  ]
}
Provide exactly 3 suggestions. Be specific. No markdown, no preamble.`;
        const ai = await aiJson(prompt);
        parsed = { summary: ai.summary ?? "", suggestions: Array.isArray(ai.suggestions) ? ai.suggestions : [] };
      } catch (_) {
        parsed = ruleBased(ev, rows, total);
      }
    } else {
      parsed = ruleBased(ev, rows, total);
    }

    // Cache via service role.
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("ai_summaries").upsert({
      scope: "event",
      ref_id: event_id,
      summary: parsed.summary,
      suggestions: parsed.suggestions,
      generated_at: new Date().toISOString(),
    }, { onConflict: "scope,ref_id" });

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as { message?: string })?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Deterministic fallback — works with zero external dependencies.
function ruleBased(ev: { name?: string; guests?: number }, rows: SelectionRow[], total: number): { summary: string; suggestions: string[] } {
  const within = ev.budget_max ? total <= ev.budget_max : true;
  const sorted = [...rows].sort((a, b) => b.qty * b.locked_unit_price - a.qty * a.locked_unit_price);
  const top = sorted[0];
  const summary = rows.length === 0
    ? `Your ${ev.type} in ${ev.city} for ${ev.guest_count} guests has no categories selected yet. Start with the big-ticket items (venue, catering, decor) to anchor the budget.`
    : `Your ${ev.type} in ${ev.city} for ${ev.guest_count} guests currently totals ${naira(total)} across ${rows.length} categor${rows.length === 1 ? "y" : "ies"}, ${within ? "which sits within" : "which is above"} your budget ceiling. The largest line is ${top.category} at ${naira(top.qty * top.locked_unit_price)}.`;
  const suggestions = [
    { category: top?.category ?? "catering", title: "Review your largest line", detail: `Your biggest spend is ${top ? top.category : "catering"}. Request 2–3 quotes for it — it usually has the most room to negotiate.`, est_savings_ngn: top ? Math.round(top.qty * top.locked_unit_price * 0.1) : 0 },
    { category: "decor", title: "Bundle nearby vendors", detail: "Vendors in the same city often discount when booked together (e.g. decor + lighting). Ask about package rates.", est_savings_ngn: 0 },
    { category: "souvenirs", title: "Right-size guest items", detail: `For ${ev.guest_count} guests, order souvenirs and small chops to ~90% of headcount; no-shows mean full-count orders usually waste money.`, est_savings_ngn: 0 },
  ];
  return { summary, suggestions };
}
