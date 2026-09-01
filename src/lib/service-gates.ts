import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ServiceKey = "registration" | "ecommerce" | "guest_list" | "aso_ebi" | "event_management";

export interface ServiceGate {
  service: ServiceKey; enabled: boolean; price: number; currency: string;
  model: "one_off" | "per_event" | "subscription"; label: string;
}

/** Pure: does this user need to pay for a service right now?
 *  Gate off -> free. Gate on -> requires a payment record matching the model
 *  (per_event payments must match the event; one_off/subscription are account-wide). */
export function gateBlocks(
  gate: Pick<ServiceGate, "enabled" | "model"> | undefined,
  payments: Array<{ service: string; event_id: string | null; status: string }>,
  service: ServiceKey,
  eventId?: string | null,
): boolean {
  if (!gate || !gate.enabled) return false;
  const paid = payments.filter((p) => p.service === service && p.status === "paid");
  if (gate.model === "per_event") return !paid.some((p) => p.event_id === (eventId ?? null));
  return paid.length === 0;
}

export function useServiceGate(service: ServiceKey, eventId?: string | null) {
  const [state, setState] = useState<{ loading: boolean; blocked: boolean; gate: ServiceGate | null }>({
    loading: true, blocked: false, gate: null,
  });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ data: gates }, auth] = await Promise.all([
          supabase.from("service_gates").select("*").eq("service", service),
          supabase.auth.getUser(),
        ]);
        const gate = (gates?.[0] ?? null) as ServiceGate | null;
        let payments: Array<{ service: string; event_id: string | null; status: string }> = [];
        if (gate?.enabled && auth.data.user) {
          const { data } = await supabase.from("service_payments")
            .select("service, event_id, status").eq("user_id", auth.data.user.id).eq("service", service);
          payments = data ?? [];
        }
        if (live) setState({ loading: false, blocked: gateBlocks(gate ?? undefined, payments, service, eventId), gate });
      } catch (err) {
        console.warn("[useServiceGate] failed open", err);
        // Fail open — never leave GateGuard spinning (looks like a blank page).
        if (live) setState({ loading: false, blocked: false, gate: null });
      }
    })();
    return () => { live = false; };
  }, [service, eventId]);
  return state;
}

// NOTE: service payments are recorded ONLY server-side by the zonicme-payment
// edge function after real provider verification (see GateGuard return flow).
// The former client-side recordServicePayment() was removed: with the old
// `service_payments` RLS it let any user self-insert a paid row and unlock
// services for free. Do not reintroduce a client writer for this table.
