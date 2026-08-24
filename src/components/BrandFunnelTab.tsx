import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Eye, MousePointerClick, Heart, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { toast } from "sonner";

type Product = { id: string; name: string; category: string; unit_price: number; image_url: string | null };
type Evt = { product_id: string; event_type: "view" | "click" | "shortlist" | "select" };
type Selection = { product_id: string; qty: number; locked_unit_price: number };
type Row = Product & { view: number; click: number; shortlist: number; select: number; revenue: number };

export function BrandFunnelTab({ brandId, vendorIds }: { brandId: string; vendorIds: string[] }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [ai, setAi] = useState<{ summary: string; suggestions: { title: string; detail: string }[]; generated_at?: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      if (!vendorIds.length) { setRows([]); setLoading(false); return; }
      const { data: products } = await supabase
        .from("catalog_products")
        .select("id, name, category, unit_price, image_url")
        .in("vendor_id", vendorIds);
      const list = (products ?? []) as Product[];
      const ids = list.map((p) => p.id);
      const [{ data: events }, { data: sels }] = await Promise.all([
        ids.length ? supabase.from("product_analytics_events").select("product_id, event_type").in("product_id", ids) : Promise.resolve({ data: [] as Array<{ product_id: string; event_type: string }> }),
        ids.length ? supabase.from("event_selections").select("product_id, qty, locked_unit_price").in("product_id", ids) : Promise.resolve({ data: [] as Array<{ product_id: string; qty: number; locked_unit_price: number }> }),
      ]);
      const byId = new Map<string, Row>(list.map((p) => [p.id, { ...p, view: 0, click: 0, shortlist: 0, select: 0, revenue: 0 }]));
      for (const e of (events ?? []) as Evt[]) {
        const r = byId.get(e.product_id); if (!r) continue;
        if (e.event_type in r) (r as unknown as Record<string, number>)[e.event_type]++;
      }
      for (const s of (sels ?? []) as Selection[]) {
        const r = byId.get(s.product_id); if (!r) continue;
        r.revenue += (s.qty ?? 0) * (s.locked_unit_price ?? 0);
      }
      setRows([...byId.values()].sort((a, b) => b.view - a.view));

      const { data: cached } = await supabase.from("ai_summaries").select("summary, suggestions, generated_at").eq("scope", "brand").eq("ref_id", brandId).maybeSingle();
      if (cached) setAi({ summary: cached.summary, suggestions: (cached.suggestions as string[]) ?? [], generated_at: cached.generated_at });
      setLoading(false);
    })();
  }, [brandId, vendorIds.join(",")]);

  const totals = useMemo(() => {
    const t = { view: 0, click: 0, shortlist: 0, select: 0, revenue: 0 };
    for (const r of rows) { t.view += r.view; t.click += r.click; t.shortlist += r.shortlist; t.select += r.select; t.revenue += r.revenue; }
    return t;
  }, [rows]);

  const generate = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brand-ai-summary", { body: { brand_id: brandId } });
      if (error) throw error;
      const resp = data as { summary?: string; suggestions?: string[]; error?: string };
      if (resp?.error) throw new Error(resp.error);
      setAi({ summary: data.summary, suggestions: data.suggestions ?? [], generated_at: new Date().toISOString() });
      toast.success("AI summary refreshed");
    } catch (e) {
      toast.error(e.message ?? "Could not generate summary");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  if (!rows.length) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">No catalog products yet. Add products in the Catalog tab to start collecting funnel analytics.</CardContent></Card>;
  }

  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <FunnelStat icon={Eye} label="Views" value={totals.view} />
        <FunnelStat icon={MousePointerClick} label="Clicks" value={totals.click} hint={`${pct(totals.click, totals.view)}% CTR`} />
        <FunnelStat icon={Heart} label="Shortlists" value={totals.shortlist} hint={`${pct(totals.shortlist, totals.view)}% of views`} />
        <FunnelStat icon={CheckCircle2} label="Selections" value={totals.select} hint={`${pct(totals.select, totals.view)}% conversion`} />
        <FunnelStat icon={TrendingUp} label="Revenue" value={totals.revenue} format="naira" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI performance summary</CardTitle>
          <Button size="sm" onClick={generate} disabled={aiLoading}>
            {aiLoading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating</> : ai ? "Refresh" : "Generate"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!ai ? (
            <p className="text-sm text-muted-foreground">Generate an AI-powered summary of your funnel — what's converting, what's stalling, and what to do next.</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed">{ai.summary}</p>
              {ai.suggestions?.length > 0 && (
                <div className="grid sm:grid-cols-3 gap-2 pt-2">
                  {ai.suggestions.map((s, i) => (
                    <div key={i} className="rounded-lg border bg-muted/30 p-3">
                      <div className="font-medium text-sm">{s.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{s.detail}</div>
                    </div>
                  ))}
                </div>
              )}
              {ai.generated_at && <div className="text-[10px] text-muted-foreground">Updated {new Date(ai.generated_at).toLocaleString()}</div>}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Per-product funnel</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {rows.map((r) => {
            const conv = pct(r.select, r.view);
            return (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-3">
                  {r.image_url && <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded object-cover" loading="lazy" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.category.replace(/_/g, " ")} · {formatNaira(r.unit_price)}</div>
                  </div>
                  <Badge variant={conv > 0 ? "default" : "secondary"} className="text-xs">{conv}% conv</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <FunnelStep label="Views" value={r.view} max={Math.max(1, totals.view)} />
                  <FunnelStep label="Clicks" value={r.click} max={Math.max(1, r.view)} />
                  <FunnelStep label="Shortlists" value={r.shortlist} max={Math.max(1, r.view)} />
                  <FunnelStep label="Selections" value={r.select} max={Math.max(1, r.view)} tone="primary" />
                </div>
                {r.revenue > 0 && <div className="text-xs text-muted-foreground">Attributed revenue: <span className="font-medium text-foreground">{formatNaira(r.revenue)}</span></div>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function FunnelStat({ icon: Icon, label, value, hint, format }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; hint?: string; format?: "naira" }) {
  return (
    <Card><CardContent className="p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="text-2xl font-display">{format === "naira" ? formatNaira(value) : value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </CardContent></Card>
  );
}

function FunnelStep({ label, value, max, tone }: { label: string; value: number; max: number; tone?: "primary" }) {
  return (
    <div>
      <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>
      <Progress value={(value / max) * 100} className={tone === "primary" ? "h-1.5 mt-1" : "h-1.5 mt-1 opacity-70"} />
    </div>
  );
}
