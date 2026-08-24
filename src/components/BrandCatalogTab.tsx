import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { prettyCategory } from "@/lib/vendor-categories";
import { formatNaira } from "@/lib/format";

type ProductRow = {
  id: string; name: string; category: string; unit_price: number;
  view: number; click: number; shortlist: number; select: number; revenue: number;
};

export function BrandCatalogTab({ brandId, vendorIds }: { brandId: string; vendorIds: string[] }) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<{ summary: string; suggestions: string[] } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: products } = vendorIds.length
        ? await supabase.from("catalog_products").select("id, name, category, unit_price").in("vendor_id", vendorIds)
        : { data: [] as Array<Record<string, unknown>> };
      const map: Record<string, ProductRow> = {};
      for (const p of products ?? []) map[p.id] = { ...(p as Record<string, unknown>), view: 0, click: 0, shortlist: 0, select: 0, revenue: 0 } as (typeof map)[string];
      const ids = Object.keys(map);
      if (ids.length) {
        const [{ data: events }, { data: sels }] = await Promise.all([
          supabase.from("product_analytics_events").select("product_id, event_type").in("product_id", ids),
          supabase.from("event_selections").select("product_id, qty, locked_unit_price").in("product_id", ids),
        ]);
        for (const e of events ?? []) if (map[e.product_id]) (map[e.product_id] as unknown as Record<string, number>)[e.event_type]++;
        for (const s of sels ?? []) if (map[s.product_id]) map[s.product_id].revenue += s.qty * s.locked_unit_price;
      }
      setRows(Object.values(map).sort((a, b) => b.revenue - a.revenue || b.view - a.view));

      const { data: cached } = await supabase.from("ai_summaries").select("summary, suggestions").eq("scope", "brand").eq("ref_id", brandId).maybeSingle();
      if (cached) setAiSummary({ summary: cached.summary, suggestions: (cached.suggestions as string[]) ?? [] });
      setLoading(false);
    })();
  }, [brandId, vendorIds.join(",")]);

  const generateAI = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("brand-ai-summary", { body: { brand_id: brandId } });
    setGenerating(false);
    if (error) return toast.error(error.message);
    const resp = data as { summary?: string; suggestions?: string[]; error?: string };
    if (resp?.error) return toast.error(resp.error);
    setAiSummary({ summary: resp.summary ?? "", suggestions: resp.suggestions ?? [] });
    toast.success("AI summary refreshed");
  };

  const totals = rows.reduce((acc, r) => ({ view: acc.view + r.view, click: acc.click + r.click, shortlist: acc.shortlist + r.shortlist, select: acc.select + r.select, revenue: acc.revenue + r.revenue }), { view: 0, click: 0, shortlist: 0, select: 0, revenue: 0 });

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Views</p><p className="text-2xl font-display">{totals.view}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Clicks</p><p className="text-2xl font-display">{totals.click}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Shortlists</p><p className="text-2xl font-display">{totals.shortlist}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Selections</p><p className="text-2xl font-display">{totals.select}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Attributed revenue</p><p className="text-xl font-display text-primary">{formatNaira(totals.revenue)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Per-product funnel</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No products in your catalog yet. An admin can add them.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left bg-muted/40">
                <tr>
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium">Category</th>
                  <th className="p-3 font-medium text-right">Views</th>
                  <th className="p-3 font-medium text-right">Clicks</th>
                  <th className="p-3 font-medium text-right">Short</th>
                  <th className="p-3 font-medium text-right">Picks</th>
                  <th className="p-3 font-medium text-right">Conv %</th>
                  <th className="p-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-xs text-muted-foreground">{prettyCategory(r.category)}</td>
                    <td className="p-3 text-right">{r.view}</td>
                    <td className="p-3 text-right">{r.click}</td>
                    <td className="p-3 text-right">{r.shortlist}</td>
                    <td className="p-3 text-right">{r.select}</td>
                    <td className="p-3 text-right">{r.view ? Math.round((r.select / r.view) * 100) : 0}%</td>
                    <td className="p-3 text-right font-medium text-primary">{formatNaira(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI weekly summary</CardTitle>
          <Button size="sm" variant="outline" onClick={generateAI} disabled={generating}>{generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}{aiSummary ? "Regenerate" : "Generate"}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiSummary ? (
            <>
              <p className="text-sm text-muted-foreground">{aiSummary.summary}</p>
              <div className="grid sm:grid-cols-3 gap-2">
                {aiSummary.suggestions.map((s: string, i: number) => (
                  <Card key={i} className="p-3 bg-muted/30"><h4 className="font-medium text-sm">{s.title}</h4><p className="text-xs text-muted-foreground mt-1">{s.detail}</p></Card>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-muted-foreground">Generate an AI-written summary of your funnel and 3 suggestions to grow bookings.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
