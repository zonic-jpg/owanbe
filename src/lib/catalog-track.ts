import { supabase } from "@/integrations/supabase/client";

export type ProductEventType = "view" | "click" | "shortlist" | "select";

export async function trackProductEvent(productId: string, type: ProductEventType, eventId?: string) {
  try {
    const session = (typeof window !== "undefined" && (window.crypto?.randomUUID?.() ?? "anon")) || "anon";
    await supabase.rpc("record_product_event", { _product: productId, _type: type, _session: session, _event: eventId ?? null });
  } catch {
    // analytics is best-effort
  }
}
