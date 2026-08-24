// ZonicMe shared payment interface — used by any app in the portfolio.
// Primary: Flutterwave. Fallback: Paystack. Last resort (no keys): returns a
// clear "not configured" error so the app can degrade gracefully.
//
// Set in Supabase → Edge Functions → Secrets:
//   FLUTTERWAVE_SECRET_KEY   (primary)
//   PAYSTACK_SECRET_KEY      (fallback)
//   PAYMENT_PRIMARY          (optional: "flutterwave" | "paystack", default flutterwave)
//
// The app only ever calls this function; it never talks to a gateway directly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FLW = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";
const PSK = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const PRIMARY = (Deno.env.get("PAYMENT_PRIMARY") ?? "flutterwave").toLowerCase();

// Server-authoritative plan pricing (keep in sync with src/lib/brand-plans.ts).
const PLANS: Record<string, { amount: number; days: number }> = {
  monthly: { amount: 100000, days: 30 },
  annual: { amount: 1000000, days: 365 },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Which providers are available, primary first.
function providerOrder(): ("flutterwave" | "paystack")[] {
  const order: ("flutterwave" | "paystack")[] = PRIMARY === "paystack"
    ? ["paystack", "flutterwave"]
    : ["flutterwave", "paystack"];
  return order.filter((p) => (p === "flutterwave" ? FLW : PSK).length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { action, brand_id, plan, email, redirect_base, reference, provider } = await req.json();

    if (action === "initialize") {
      const planMeta = PLANS[plan];
      if (!planMeta) return json({ error: "Unknown plan" }, 400);
      const order = providerOrder();
      if (order.length === 0) return json({ error: "No payment provider configured. Add FLUTTERWAVE_SECRET_KEY or PAYSTACK_SECRET_KEY." }, 503);

      const txRef = `OWB-${brand_id}-${plan}-${Date.now()}`;
      const redirectUrl = `${(redirect_base ?? "").replace(/\/$/, "")}/brand/onboarding?pay=return`;

      let lastErr = "";
      for (const prov of order) {
        try {
          if (prov === "flutterwave") {
            const r = await fetch("https://api.flutterwave.com/v3/payments", {
              method: "POST",
              headers: { Authorization: `Bearer ${FLW}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                tx_ref: txRef,
                amount: planMeta.amount,
                currency: "NGN",
                redirect_url: redirectUrl,
                customer: { email: email ?? "customer@owanbe.app" },
                meta: { brand_id, plan },
                customizations: { title: "Owanbe Joy", description: `${plan} brand plan` },
              }),
            });
            const d = await r.json();
            if (r.ok && d?.status === "success" && d?.data?.link) {
              return json({ checkoutUrl: d.data.link, reference: txRef, provider: "flutterwave" });
            }
            lastErr = `flutterwave: ${JSON.stringify(d).slice(0, 160)}`;
          } else {
            const r = await fetch("https://api.paystack.co/transaction/initialize", {
              method: "POST",
              headers: { Authorization: `Bearer ${PSK}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                email: email ?? "customer@owanbe.app",
                amount: planMeta.amount * 100, // kobo
                currency: "NGN",
                reference: txRef,
                callback_url: redirectUrl,
                metadata: { brand_id, plan },
              }),
            });
            const d = await r.json();
            if (r.ok && d?.status === true && d?.data?.authorization_url) {
              return json({ checkoutUrl: d.data.authorization_url, reference: txRef, provider: "paystack" });
            }
            lastErr = `paystack: ${JSON.stringify(d).slice(0, 160)}`;
          }
        } catch (e) {
          lastErr = `${prov}: ${String((e as { message?: string })?.message ?? e)}`;
        }
      }
      return json({ error: `All payment providers failed. ${lastErr}` }, 502);
    }

    if (action === "verify") {
      if (!reference) return json({ error: "reference required" }, 400);
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Idempotency: if we already recorded this reference as succeeded, stop.
      const { data: existing } = await admin.from("brand_payments").select("id, status").eq("external_ref", reference).maybeSingle();
      if (existing?.status === "succeeded") return json({ ok: true, already: true });

      let ok = false, amount = 0, meta: Record<string, unknown> = {}, used = provider ?? "";
      if ((provider ?? "flutterwave") === "flutterwave" && FLW) {
        const r = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${FLW}` },
        });
        const d = await r.json();
        ok = d?.status === "success" && d?.data?.status === "successful";
        amount = Number(d?.data?.amount ?? 0);
        meta = d?.data?.meta ?? {};
        used = "flutterwave";
      } else if (PSK) {
        const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${PSK}` },
        });
        const d = await r.json();
        ok = d?.status === true && d?.data?.status === "success";
        amount = Number(d?.data?.amount ?? 0) / 100; // kobo → NGN
        meta = d?.data?.metadata ?? {};
        used = "paystack";
      }

      if (!ok) return json({ ok: false, error: "Payment not successful" });

      const planKey = (meta?.plan as string) ?? reference.split("-")[2];
      const brandId = (meta?.brand_id as string) ?? reference.split("-")[1];
      const planMeta = PLANS[planKey] ?? PLANS.monthly;

      const periodEnd = new Date(Date.now() + planMeta.days * 86_400_000).toISOString();
      const { data: subRow, error: subErr } = await admin.from("brand_subscriptions").insert({
        brand_id: brandId, plan: planKey, amount: planMeta.amount, status: "active", period_end: periodEnd, is_waived: false,
      }).select("id").single();
      if (subErr) return json({ ok: false, error: subErr.message });

      await admin.from("brand_payments").insert({
        brand_id: brandId, subscription_id: subRow.id, amount: amount || planMeta.amount,
        status: "succeeded", method: used, external_ref: reference,
      });

      return json({ ok: true, provider: used });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as { message?: string })?.message ?? e) }, 500);
  }
});
