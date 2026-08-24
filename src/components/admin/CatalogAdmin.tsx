import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { prettyCategory } from "@/lib/vendor-categories";

const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export function CatalogAdmin() {
  const [counts, setCounts] = useState<{ category: string; count: number; avg_price: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("catalog_products").select("category, unit_price");
    const map = new Map<string, { count: number; total: number }>();
    for (const r of data ?? []) {
      const cur = map.get(r.category) ?? { count: 0, total: 0 };
      map.set(r.category, { count: cur.count + 1, total: cur.total + (r.unit_price ?? 0) });
    }
    const rows = [...map.entries()].map(([category, v]) => ({ category, count: v.count, avg_price: Math.round(v.total / v.count) })).sort((a, b) => a.category.localeCompare(b.category));
    setCounts(rows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const seed = async () => {
    setSeeding(true);
    const { data, error } = await supabase.functions.invoke("seed-catalog", {});
    setSeeding(false);
    if (error) return toast.error(error.message);
    const resp = data as { error?: string; inserted?: number; updated?: number };
    if (resp?.error) return toast.error(resp.error);
    toast.success(`Seeded: ${resp.inserted} new, ${resp.updated} updated`);
    load();
  };

  const total = counts.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-lg flex items-center gap-2"><Database className="w-5 h-5 text-primary" /> Catalog products</h3>
          <p className="text-sm text-muted-foreground">{total} active products across {counts.length} categories. Seed populates the curated demo catalog (idempotent).</p>
        </div>
        <Button onClick={seed} disabled={seeding}>{seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}Seed / refresh catalog</Button>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium text-right">Products</th>
                <th className="p-3 font-medium text-right">Avg price</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((r) => (
                <tr key={r.category} className="border-t">
                  <td className="p-3 capitalize">{prettyCategory(r.category)}</td>
                  <td className="p-3 text-right"><Badge variant="secondary">{r.count}</Badge></td>
                  <td className="p-3 text-right">{fmt(r.avg_price)}</td>
                </tr>
              ))}
              {!counts.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No products yet — click Seed.</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
