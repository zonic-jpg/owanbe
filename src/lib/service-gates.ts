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

export type GateState = {
  loading: boolean;
  blocked: boolean;
  gate: ServiceGate | null;
  /** True when there is no session at all. Every write behind the gate would
   *  run as anon and be refused, so the caller must ask for sign-in rather
   *  than render a page whose Save button can only ever fail. */
  needsSignIn: boolean;
  /** True when the gate could not be read. Rendering still fails open, but the
   *  caller can say so instead of implying the service is unlocked. */
  unknown: boolean;
};

export function useServiceGate(service: ServiceKey, eventId?: string | null) {
  const [state, setState] = useState<GateState>({
    loading: true, blocked: false, gate: null, needsSignIn: false, unknown: false,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [gateRes, auth] = await Promise.all([
          supabase.from("service_gates").select("*").eq("service", service),
          supabase.auth.getUser(),
        ]);
        const user = auth.data.user;
        // A refused read is not the same as "no gate configured"; the previous
        // version ignored `error` entirely and treated both as unlocked.
        const gateUnknown = !!gateRes.error;
        const gate = (gateRes.data?.[0] ?? null) as ServiceGate | null;

        if (!user) {
          if (live) setState({ loading: false, blocked: false, gate, needsSignIn: true, unknown: gateUnknown });
          return;
        }

        let payments: Array<{ service: string; event_id: string | null; status: string }> = [];
        let paymentsUnknown = false;
        if (gate?.enabled) {
          const { data, error } = await supabase.from("service_payments")
            .select("service, event_id, status").eq("user_id", user.id).eq("service", service);
          paymentsUnknown = !!error;
          payments = data ?? [];
        }

        if (live) {
          setState({
            loading: false,
            // Never hold someone out of a paid service because we could not
            // read their receipts; the server-side RLS check is authoritative.
            blocked: paymentsUnknown ? false : gateBlocks(gate ?? undefined, payments, service, eventId),
            gate,
            needsSignIn: false,
            unknown: gateUnknown || paymentsUnknown,
          });
        }
      } catch (err) {
        console.warn("[useServiceGate] gate read failed", err);
        // Fail open — never leave GateGuard spinning (looks like a blank page).
        if (live) setState({ loading: false, blocked: false, gate: null, needsSignIn: false, unknown: true });
      }
    })();
    return () => { live = false; };
  }, [service, eventId, nonce]);

  return { ...state, refresh: () => setNonce((n) => n + 1) };
}

// NOTE: service payments are recorded ONLY server-side by the zonicme-payment
// edge function after real provider verification (see GateGuard return flow).
// The former client-side recordServicePayment() was removed: with the old
// `service_payments` RLS it let any user self-insert a paid row and unlock
// services for free. Do not reintroduce a client writer for this table.
