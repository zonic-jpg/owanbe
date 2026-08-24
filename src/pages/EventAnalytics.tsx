import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Sparkles, Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { prettyCategory } from "@/lib/vendor-categories";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
const COLORS = ["hsl(var(--primary))", "#D4AF37", "#7B1E2C", "#2A6F4D", "#4F3A78", "#C46A4A", "#1E5A8A", "#8A6AC4", "#C4A06A"];

export default function EventAnalytics() {
  const { id } = useParams();
  const [event, setEvent] = useState<import("@/integrations/supabase/types").Database["public"]["Tables"]["events"]["Row"] | null>(null);
  const [selections, setSelections] = useState<Array<Record<string, unknown>>>([]);
  const [benchmark, setBenchmark] = useState<{ avg: number; count: number } | null>(null);
  const [aiSummary, setAiSummary] = useState<{ summary: string; suggestions: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: ev } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      setEvent(ev);
      const { data: sel } = await supabase
        .from("event_selections")
        .select("category, qty, locked_unit_price, catalog_products(name)")
        .eq("event_id", id);
      setSelections(sel ?? []);

      const { data: cached } = await supabase.from("ai_summaries").select("summary, suggestions").eq("scope", "event").eq("ref_id", id).maybeSingle();
      if (cached) setAiSummary({ summary: cached.summary, suggestions: (cached.suggestions as string[]) ?? [] });

      // Benchmark vs similar events
      if (ev) {
        const band = ev.guest_count < 150 ? "small" : ev.guest_count < 350 ? "medium" : ev.guest_count < 700 ? "large" : "mega";
        const { data: peers } = await supabase.from("event_spend_summary").select("total_spend").eq("city", ev.city).eq("guest_band", band).neq("event_id", id).gt("total_spend", 0);
        if (peers?.length) {
          const avg = Math.round(peers.reduce((s: number, r: { total_spend: unknown }) => s + Number(r.total_spend), 0) / peers.length);
          setBenchmark({ avg, count: peers.length });
        }
      }
      setLoading(false);
    })();
  }, [id]);

  const generateAI = async () => {
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("event-ai-summary", { body: { event_id: id } });
    setGenerating(false);
    if (error) return toast.error(error.message);
    const resp = data as { error?: string; summary?: string; suggestions?: string[] };
    if (resp?.error) return toast.error(resp.error);
    setAiSummary({ summary: resp.summary ?? "", suggestions: resp.suggestions ?? [] });
    toast.success("AI summary generated");
  };

  if (loading) return <AppShell><div className="container py-10 space-y-4"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64" /></div></AppShell>;
  if (!event) return <AppShell><div className="container py-20 text-center">Event not found.</div></AppShell>;

  const total = selections.reduce((s, r) => s + r.qty * r.locked_unit_price, 0);
  const avg = selections.length ? Math.round(total / selections.length) : 0;
  const pct = event.budget_max ? Math.round((total / event.budget_max) * 100) : 0;

  const byCategory = selections.map((r) => ({ name: prettyCategory(r.category), value: r.qty * r.locked_unit_price })).sort((a, b) => b.value - a.value);

  const benchmarkDelta = benchmark ? total - benchmark.avg : 0;

  return (
    <AppShell>
      <div className="container py-6 md:py-10 space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to={`/events/${id}`}><ArrowLeft className="w-4 h-4 mr-1" /> Back to event</Link></Button>

        <div>
          <h1 className="font-display text-3xl md:text-4xl">Analytics</h1>
          <p className="text-muted-foreground">Spend breakdown, benchmarks and AI suggestions for {event.name}.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Total spend</p><p className="text-2xl font-display text-primary mt-1">{fmt(total)}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Avg / category</p><p className="text-2xl font-display mt-1">{fmt(avg)}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">Categories picked</p><p className="text-2xl font-display mt-1">{selections.length}</p></Card>
          <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">% of budget</p><p className={`text-2xl font-display mt-1 ${pct > 100 ? "text-destructive" : ""}`}>{pct}%</p></Card>
        </div>

        {benchmark && (
          <Card className="p-4 flex items-center gap-3">
            {benchmarkDelta < 0 ? <TrendingDown className="w-6 h-6 text-emerald-500" /> : <TrendingUp className="w-6 h-6 text-amber-500" />}
            <div className="flex-1">
              <p className="text-sm font-medium">vs {benchmark.count} similar {event.city} events ({event.guest_count} guests)</p>
              <p className="text-xs text-muted-foreground">Average peer spend: {fmt(benchmark.avg)} — you are {benchmarkDelta < 0 ? `${fmt(Math.abs(benchmarkDelta))} below` : `${fmt(benchmarkDelta)} above`} average</p>
            </div>
          </Card>
        )}

        {selections.length > 0 && (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-display text-lg mb-3">Spend by category</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={50} outerRadius={100}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h3 className="font-display text-lg mb-3">Top categories</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byCategory.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tickFormatter={(v) => `₦${(v / 1_000_000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> AI summary & cost-saving tips</h3>
            <Button size="sm" variant="outline" onClick={generateAI} disabled={generating}>{generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}{aiSummary ? "Regenerate" : "Generate"}</Button>
          </div>
          {aiSummary ? (
            <>
              <p className="text-sm text-muted-foreground">{aiSummary.summary}</p>
              <div className="grid sm:grid-cols-3 gap-2">
                {aiSummary.suggestions.map((s: string, i: number) => (
                  <Card key={i} className="p-3 bg-muted/30 space-y-1">
                    {s.category && <Badge variant="outline" className="capitalize text-[10px]">{prettyCategory(s.category)}</Badge>}
                    <h4 className="font-medium text-sm">{s.title}</h4>
                    <p className="text-xs text-muted-foreground">{s.detail}</p>
                    {s.est_savings_ngn > 0 && <p className="text-xs font-semibold text-emerald-600">Save ~{fmt(s.est_savings_ngn)}</p>}
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Generate an AI summary that analyses your picks vs Lagos market norms and suggests 3 swaps.</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
