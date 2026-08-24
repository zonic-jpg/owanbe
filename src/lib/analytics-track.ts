import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type EventType = Database["public"]["Enums"]["vendor_event_type"];

function sessionId(): string {
  const KEY = "owanbe.session";
  try {
    let s = localStorage.getItem(KEY);
    if (!s) {
      s = crypto.randomUUID();
      localStorage.setItem(KEY, s);
    }
    return s;
  } catch {
    return "anon";
  }
}

const recent = new Map<string, number>();
const DEDUPE_MS = 30_000;

/** Fire-and-forget event tracking. Dedupes (vendor,type) within 30s. */
export function trackVendorEvent(vendorId: string, eventType: EventType): void {
  if (!vendorId) return;
  const key = `${vendorId}:${eventType}`;
  const last = recent.get(key) ?? 0;
  const now = Date.now();
  if (now - last < DEDUPE_MS) return;
  recent.set(key, now);

  void supabase.rpc("record_vendor_event", {
    _vendor: vendorId,
    _type: eventType,
    _session: sessionId(),
  }).then(() => {}, () => {});
}
