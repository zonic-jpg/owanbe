import { supabase } from "@/integrations/supabase/client";

// Client wrapper around the shared ZonicMe payment function. The app never talks
// to Flutterwave/Paystack directly — it always goes through this interface, so
// every app in the portfolio collects (and later disburses) the same way.

export type PayResult = { ok: boolean; error?: string };

/** Start a brand subscription payment. Redirects the browser to the gateway. */
export async function startBrandPayment(opts: {
  brandId: string;
  plan: "monthly" | "annual";
  email?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("zonicme-payment", {
    body: {
      action: "initialize",
      brand_id: opts.brandId,
      plan: opts.plan,
      email: opts.email,
      redirect_base: window.location.origin,
    },
  });
  if (error) throw new Error(error.message);
  const resp = data as { error?: string; checkoutUrl?: string; provider?: string };
  if (resp?.error) throw new Error(resp.error);
  const url = resp?.checkoutUrl;
  if (!url) throw new Error("No checkout URL returned");
  try {
    sessionStorage.setItem("owb_pay_provider", resp?.provider ?? "");
  } catch {
    /* ignore */
  }
  window.location.href = url;
}

/**
 * Call on a page that may be a payment redirect target. Returns null if this
 * isn't a return, otherwise verifies the payment server-side and reports the
 * outcome. The gateway appends its own params:
 *   Flutterwave → ?status=&tx_ref=&transaction_id=
 *   Paystack    → ?reference=&trxref=
 */
export async function verifyPaymentReturn(): Promise<PayResult | null> {
  const params = new URLSearchParams(window.location.search);
  if (params.get("pay") !== "return") return null;

  const reference = params.get("tx_ref") ?? params.get("reference") ?? params.get("trxref") ?? "";
  let provider = params.get("tx_ref") ? "flutterwave" : "paystack";
  try {
    const saved = sessionStorage.getItem("owb_pay_provider");
    if (saved) provider = saved;
    sessionStorage.removeItem("owb_pay_provider");
  } catch {
    /* ignore */
  }

  if (!reference) return { ok: false, error: "No payment reference was returned." };

  const { data, error } = await supabase.functions.invoke("zonicme-payment", {
    body: { action: "verify", reference, provider },
  });
  if (error) return { ok: false, error: error.message };
  const v = data as { ok?: boolean; error?: string };
  return { ok: !!v?.ok, error: v?.error };
}
