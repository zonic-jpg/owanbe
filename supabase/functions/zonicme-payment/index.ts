// ZonicMe shared payment interface — used by any app in the portfolio.
// Primary: Flutterwave. Fallback: Paystack. Last resort (no keys): returns a
// clear "not configured" error so the app can degrade gracefully.
//
// Set in Supabase → Edge Functions → Secrets:
//   FLUTTERWAVE_SECRET_KEY   (primary)
//   PAYSTACK_SECRET_KEY      (fallback)
//   PAYMENT_PRIMARY          (optional: "flutterwave" | "paystack", default flutterwave)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (auto-provided)
//
// The app only ever calls this function; it never talks to a gateway directly.
//
// TWO payment kinds are handled:
//   • BRAND plans   (plan = "monthly" | "annual")   -> brand_subscriptions / brand_payments
//   • SERVICE gates (plan = "service:<svc>[:<eventId>]") -> service_payments
// Service pricing is read SERVER-SIDE from public.service_gates, and the paid
// row is written ONLY here (service role) after real provider verification —
// the client can no longer forge a paid record.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FLW = Deno.env.get("FLUTTERWAVE_SECRET_KEY") ?? "";
const PSK = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
const PRIMARY = (Deno.env.get("PAYMENT_PRIMARY") ?? "flutterwave").toLowerCase();

// Server-authoritative BRAND plan pricing (keep in sync with src/lib/brand-plans.ts).
const PLANS: Record<string, { amount: number; days: number }> = {
  monthly: { amount: 100000, days: 30 },
  annual: { amount: 1000000, days: 365 },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Which providers are available, primary first.
function providerOrder(): ("flutterwave" | "paystack")[] {
  const order: ("flutterwave" | "paystack")[] = PRIMARY === "paystack"
    ? ["paystack", "flutterwave"]
    : ["flutterwave", "paystack"];
  return order.filter((p) => (p === "flutterwave" ? FLW : PSK).length > 0);
}

// Resolve the authenticated caller from the forwarded JWT (never trust the body
// for identity). Returns null when unauthenticated.
async function callerFromJwt(req: Request): Promise<{ id: string; email: string | null } | null> {
  const authz = req.headers.get("Authorization") ?? "";
  const jwt = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!jwt) return null;
  const { data, error } = await admin().auth.getUser(jwt);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { action, brand_id, plan, email, redirect_base, reference, provider } = await req.json();

    // ═══════════════════════ INITIALIZE ═══════════════════════
    if (action === "initialize") {
      const order = providerOrder();
      if (order.length === 0) {
        return json({ error: "No payment provider configured. Add FLUTTERWAVE_SECRET_KEY or PAYSTACK_SECRET_KEY." }, 503);
      }

      // ---- SERVICE-GATE checkout (plan = "service:<svc>[:<eventId>]") ----
      if (typeof plan === "string" && plan.startsWith("service:")) {
        const [, svc, ev] = plan.split(":");
        const eventId = ev && ev.length ? ev : null;

        const caller = await callerFromJwt(req);
        if (!caller) return json({ error: "Sign in required to pay for a service." }, 401);

        // Server-side price/model straight from the gate — client cannot set it.
        const { data: gate, error: gErr } = await admin()
          .from("service_gates").select("service, enabled, price, currency, model").eq("service", svc).maybeSingle();
        if (gErr) return json({ error: gErr.message }, 500);
        if (!gate) return json({ error: "Unknown service" }, 400);
        if (!gate.enabled || Number(gate.price) <= 0) {
          return json({ error: "This service is free — no payment required." }, 400);
        }

        const amountNgn = Number(gate.price);
        const currency = gate.currency ?? "NGN";
        const txRef = `OWBSVC-${svc}-${eventId ?? "acct"}-${Date.now()}`;
        const redirectUrl = `${(redirect_base ?? "").replace(/[?#].*$/, "").replace(/\/$/, "")}?svcpay=${encodeURIComponent(txRef)}`;
        const meta = { kind: "service", svc, event_id: eventId, user_id: caller.id, currency };
        const custEmail = caller.email ?? email ?? "customer@owanbe.app";

        let lastErr = "";
        for (const prov of order) {
          try {
            if (prov === "flutterwave") {
              const r = await fetch("https://api.flutterwave.com/v3/payments", {
                method: "POST",
                headers: { Authorization: `Bearer ${FLW}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  tx_ref: txRef, amount: amountNgn, currency, redirect_url: redirectUrl,
                  customer: { email: custEmail }, meta,
                  customizations: { title: "Owanbe Joy", description: `${svc} service` },
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
                  email: custEmail, amount: amountNgn * 100, currency, reference: txRef,
                  callback_url: redirectUrl, metadata: meta,
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

      // ---- BRAND plan checkout (plan = "monthly" | "annual") ----
      const planMeta = PLANS[plan];
      if (!planMeta) return json({ error: "Unknown plan" }, 400);

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

    // ═══════════════════════ VERIFY ═══════════════════════
    if (action === "verify") {
      if (!reference) return json({ error: "reference required" }, 400);
      const db = admin();
      const isService = typeof reference === "string" && reference.startsWith("OWBSVC-");

      // Idempotency (per kind).
      if (isService) {
        const { data: existing } = await db.from("service_payments").select("id").eq("reference", reference).maybeSingle();
        if (existing) return json({ ok: true, already: true });
      } else {
        const { data: existing } = await db.from("brand_payments").select("id, status").eq("external_ref", reference).maybeSingle();
        if (existing?.status === "succeeded") return json({ ok: true, already: true });
      }

      // Provider verification. The browser return doesn't tell us which gateway
      // settled, so try each available provider (caller hint first) until one
      // confirms the transaction.
      const tryOrder = (provider ? [provider, ...providerOrder()] : providerOrder())
        .filter((p, i, a) => a.indexOf(p) === i) as ("flutterwave" | "paystack")[];
      let ok = false, amount = 0, meta: Record<string, unknown> = {}, used = "";
      for (const prov of tryOrder) {
        try {
          if (prov === "flutterwave" && FLW) {
            const r = await fetch(`https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
              headers: { Authorization: `Bearer ${FLW}` },
            });
            const d = await r.json();
            if (d?.status === "success" && d?.data?.status === "successful") {
              ok = true; amount = Number(d?.data?.amount ?? 0); meta = d?.data?.meta ?? {}; used = "flutterwave"; break;
            }
          } else if (prov === "paystack" && PSK) {
            const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
              headers: { Authorization: `Bearer ${PSK}` },
            });
            const d = await r.json();
            if (d?.status === true && d?.data?.status === "success") {
              ok = true; amount = Number(d?.data?.amount ?? 0) / 100; meta = d?.data?.metadata ?? {}; used = "paystack"; break;
            }
          }
        } catch { /* try next provider */ }
      }

      if (!ok) return json({ ok: false, error: "Payment not successful" });

      // ---- SERVICE-GATE settlement ----
      if (isService) {
        const svc = String(meta?.svc ?? "");
        const userId = meta?.user_id ? String(meta.user_id) : null;
        const eventId = meta?.event_id ? String(meta.event_id) : null;
        const currency = meta?.currency ? String(meta.currency) : "NGN";
        if (!svc || !userId) return json({ ok: false, error: "Payment metadata incomplete" });

        // Re-read the gate to record the authoritative amount.
        const { data: gate } = await db.from("service_gates").select("price, currency").eq("service", svc).maybeSingle();
        const recordAmount = amount || Number(gate?.price ?? 0);

        const { error: insErr } = await db.from("service_payments").insert({
          user_id: userId, service: svc, event_id: eventId,
          amount: recordAmount, currency: gate?.currency ?? currency,
          provider: used, reference, status: "paid",
        });
        if (insErr) return json({ ok: false, error: insErr.message });
        return json({ ok: true, provider: used, kind: "service" });
      }

      // ---- BRAND plan settlement (unchanged) ----
      const planKey = (meta?.plan as string) ?? reference.split("-")[2];
      const brandId = (meta?.brand_id as string) ?? reference.split("-")[1];
      const planMeta = PLANS[planKey] ?? PLANS.monthly;

      const periodEnd = new Date(Date.now() + planMeta.days * 86_400_000).toISOString();
      const { data: subRow, error: subErr } = await db.from("brand_subscriptions").insert({
        brand_id: brandId, plan: planKey, amount: planMeta.amount, status: "active", period_end: periodEnd, is_waived: false,
      }).select("id").single();
      if (subErr) return json({ ok: false, error: subErr.message });

      await db.from("brand_payments").insert({
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
