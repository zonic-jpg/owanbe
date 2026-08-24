import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export function TiersAdmin() {
  const [rows, setRows] = useState<import("@/integrations/supabase/types").Database["public"]["Tables"]["tiers"]["Row"][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("tiers")
        .select("id, level, total_estimate, summary, created_at, events!inner(name, city, type, guest_count)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) toast.error(error.message); else setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Read-only view of recent AI-generated tiers across all events.</p>
      {rows.map((t) => (
        <Card key={t.id} className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg capitalize">{t.level} — {t.events?.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">{t.events?.type} • {t.events?.city} • {t.events?.guest_count} guests</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display text-primary">{fmt(t.total_estimate)}</p>
              <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          {t.summary && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.summary}</p>}
        </Card>
      ))}
      {!rows.length && <p className="text-center text-muted-foreground py-8">No tiers generated yet.</p>}
    </div>
  );
}
