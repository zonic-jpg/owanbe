import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Ctx = {
  eventId: string | null;
  eventName: string | null;
  vendorIds: Set<string>;
  loading: boolean;
  isShortlisted: (vendorId: string) => boolean;
  toggle: (vendorId: string, vendorName?: string) => Promise<void>;
  remove: (vendorId: string) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

const ShortlistCtx = createContext<Ctx | null>(null);

export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);
  const [vendorIds, setVendorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setEventId(null);
      setEventName(null);
      setVendorIds(new Set());
      return;
    }
    setLoading(true);
    const { data: events } = await supabase
      .from("events")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const ev = events?.[0];
    if (!ev) {
      setEventId(null);
      setEventName(null);
      setVendorIds(new Set());
      setLoading(false);
      return;
    }
    setEventId(ev.id);
    setEventName(ev.name);
    const { data: rows } = await supabase
      .from("shortlists")
      .select("vendor_id")
      .eq("event_id", ev.id);
    setVendorIds(new Set((rows ?? []).map((r) => r.vendor_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isShortlisted = useCallback((id: string) => vendorIds.has(id), [vendorIds]);

  const toggle = useCallback(
    async (vendorId: string, vendorName?: string) => {
      if (!user) {
        toast.error("Please sign in to shortlist vendors");
        return;
      }
      if (!eventId) {
        toast.error("Create an event first to start a shortlist");
        return;
      }
      const already = vendorIds.has(vendorId);
      // optimistic
      setVendorIds((prev) => {
        const next = new Set(prev);
        if (already) { next.delete(vendorId); } else { next.add(vendorId); }
        return next;
      });
      if (already) {
        const { error } = await supabase
          .from("shortlists")
          .delete()
          .eq("event_id", eventId)
          .eq("vendor_id", vendorId);
        if (error) {
          toast.error(error.message);
          await refresh();
        } else {
          toast.success(`Removed ${vendorName ?? "vendor"} from shortlist`);
        }
      } else {
        const { error } = await supabase
          .from("shortlists")
          .insert({ event_id: eventId, vendor_id: vendorId });
        if (error) {
          if (error.code !== "23505") {
            toast.error(error.message);
            await refresh();
            return;
          }
        }
        // fire-and-forget analytics
        import("@/lib/analytics-track").then(m => m.trackVendorEvent(vendorId, "shortlist_add"));
        toast.success(`Added ${vendorName ?? "vendor"} to shortlist`);
      }
    },
    [user, eventId, vendorIds, refresh]
  );

  const remove = useCallback(
    async (vendorId: string) => {
      if (!eventId) return;
      setVendorIds((prev) => {
        const next = new Set(prev);
        next.delete(vendorId);
        return next;
      });
      await supabase
        .from("shortlists")
        .delete()
        .eq("event_id", eventId)
        .eq("vendor_id", vendorId);
    },
    [eventId]
  );

  const clear = useCallback(async () => {
    if (!eventId) return;
    setVendorIds(new Set());
    await supabase.from("shortlists").delete().eq("event_id", eventId);
  }, [eventId]);

  return (
    <ShortlistCtx.Provider
      value={{ eventId, eventName, vendorIds, loading, isShortlisted, toggle, remove, clear, refresh }}
    >
      {children}
    </ShortlistCtx.Provider>
  );
}

export function useShortlist() {
  const ctx = useContext(ShortlistCtx);
  if (!ctx) throw new Error("useShortlist must be used within ShortlistProvider");
  return ctx;
}
