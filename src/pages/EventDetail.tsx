import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users, Sparkles, ArrowLeft, Wallet, Infinity as InfinityIcon, Plus, BarChart3, Check, Crown } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_GROUPS, prettyCategory } from "@/lib/vendor-categories";
import { CategoryBrowser } from "@/components/CategoryBrowser";
import { GateGuard } from "@/components/GateGuard";
import { EventSummaryTable, SelectionRow } from "@/components/EventSummaryTable";

const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<import("@/integrations/supabase/types").Database["public"]["Tables"]["events"]["Row"] | null>(null);
  const [selections, setSelections] = useState<SelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [browserCat, setBrowserCat] = useState<string | null>(null);

  const loadSelections = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("event_selections")
      .select("id, category, qty, locked_unit_price, catalog_products(name, unit_label, image_url)")
      .eq("event_id", id);
    setSelections((data ?? []) as typeof selections);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: ev, error: evErr } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (evErr) { toast.error(evErr.message); setLoading(false); return; }
      setEvent(ev);
      await loadSelections();
      setLoading(false);
    })();
  }, [id, loadSelections]);

  const setBudgetMode = async (mode: "fixed" | "open") => {
    const { error } = await supabase.from("events").update({ budget_mode: mode } as import("@/integrations/supabase/types").Database["public"]["Tables"]["events"]["Update"]).eq("id", id!);
    if (error) return toast.error(error.message);
    setEvent({ ...event, budget_mode: mode });
    toast.success(mode === "fixed" ? "Budget-locked mode set" : "Open-ended mode set");
  };

  const selectionByCat = new Map(selections.map((s) => [s.category, s]));

  if (loading) {
    return <AppShell><div className="container py-10 space-y-4"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64" /></div></AppShell>;
  }
  if (!event) {
    return <AppShell><div className="container py-20 text-center text-muted-foreground">Event not found.</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="container py-6 md:py-10 space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/dashboard"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link></Button>

        <Card className="p-6 bg-gradient-luxe text-white border-0 relative overflow-hidden">
          <div className="absolute inset-0 ankara-divider opacity-10" />
          <div className="relative space-y-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-display text-3xl md:text-4xl font-bold">{event.name}</h1>
                <p className="text-white/80 capitalize mt-1">{event.type}</p>
              </div>
              <Badge variant="outline" className="bg-white/10 text-white border-white/30 capitalize">{event.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-white/90">
              {event.event_date && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {new Date(event.event_date).toLocaleDateString()}</span>}
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.city}</span>
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {event.guest_count} guests</span>
            </div>
            {event.vibe && <p className="text-white/80 text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> {event.vibe}</p>}
          </div>
        </Card>

        {!event.budget_mode ? (
          <Card className="p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-2xl">Choose how you want to plan</h2>
              <p className="text-sm text-muted-foreground">Pick the planning style that fits you. You can change this later.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button onClick={() => setBudgetMode("fixed")} className="text-left rounded-xl border-2 p-5 hover:border-primary hover:bg-primary/5 transition-colors space-y-2">
                <Wallet className="w-6 h-6 text-primary" />
                <h3 className="font-semibold">Work within a budget</h3>
                <p className="text-sm text-muted-foreground">Set a total spend. We'll fit every line item to it and rebalance as you tweak.</p>
              </button>
              <button onClick={() => setBudgetMode("open")} className="text-left rounded-xl border-2 p-5 hover:border-primary hover:bg-primary/5 transition-colors space-y-2">
                <InfinityIcon className="w-6 h-6 text-primary" />
                <h3 className="font-semibold">Open-ended</h3>
                <p className="text-sm text-muted-foreground">No cap. Adjust any item and the total updates live.</p>
              </button>
            </div>
          </Card>
        ) : (
          <div className="flex items-center justify-between gap-2 text-sm">
            <Badge variant="outline" className="gap-1.5">
              {event.budget_mode === "fixed" ? <><Wallet className="w-3.5 h-3.5" /> Working within a budget</> : <><InfinityIcon className="w-3.5 h-3.5" /> Open-ended</>}
            </Badge>
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline"><Link to={`/events/${id}/guests`}><Users className="w-4 h-4 mr-1" /> Guest list</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to={`/events/${id}/aso-ebi`}><Crown className="w-4 h-4 mr-1" /> Aso-ebi</Link></Button>
              <Button asChild size="sm" variant="outline"><Link to={`/events/${id}/analytics`}><BarChart3 className="w-4 h-4 mr-1" /> Analytics</Link></Button>
              <Button size="sm" variant="ghost" onClick={() => setEvent({ ...event, budget_mode: null })}>Change mode</Button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl">Build your event</h2>
            <p className="text-sm text-muted-foreground">Pick one option per category. Tap any tile to browse products.</p>
          </div>

          {CATEGORY_GROUPS.map((group) => (
            <div key={group.label} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.categories.map((cat) => {
                  const sel = selectionByCat.get(cat);
                  return (
                    <button key={cat} onClick={() => setBrowserCat(cat)} className={`flex flex-col text-left rounded-lg border-2 p-3 transition-colors ${sel ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/40"}`}>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-sm font-semibold leading-tight">{prettyCategory(cat)}</span>
                        {sel && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </div>
                      {sel ? (
                        <>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{sel.catalog_products?.name}</p>
                          <p className="text-sm font-semibold text-primary mt-0.5">{fmt(sel.qty * sel.locked_unit_price)}</p>
                          <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            Change selection
                          </span>
                        </>
                      ) : (
                        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
                          <Plus className="w-4 h-4" /> Select
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <EventSummaryTable selections={selections} budgetMax={event.budget_max} budgetMode={event.budget_mode} />
      </div>

      <GateGuard service="ecommerce" eventId={id} featureName="E-commerce & catalog">
      <CategoryBrowser
        open={!!browserCat}
        onOpenChange={(v) => !v && setBrowserCat(null)}
        category={browserCat}
        eventId={id!}
        guestCount={event.guest_count ?? 200}
        currentSelectionId={browserCat ? (selectionByCat.get(browserCat) as { product_id?: string } | undefined)?.product_id ?? null : null}
        onPicked={loadSelections}
      />
      </GateGuard>
    </AppShell>
  );
}
