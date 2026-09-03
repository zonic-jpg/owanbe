import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { publicError } from "@/lib/publicMessage";
import { ArrowLeft, BadgeCheck, Check, Crown, Loader2, MessageCircle, ShieldCheck, ShoppingBag, Sparkles, Star, Users } from "lucide-react";
import { GateGuard } from "@/components/GateGuard";
import { bestQuoteSavings, distributionStats, rankQuotes, rfqMessage, type QuoteRow } from "@/lib/aso-ebi";
import type { Database } from "@/integrations/supabase/types";

type Campaign = Database["public"]["Tables"]["aso_ebi_campaigns"]["Row"];
type Provider = Database["public"]["Tables"]["aso_ebi_providers"]["Row"];
type OrderRow = Database["public"]["Tables"]["aso_ebi_orders"]["Row"];
type GuestOrder = Database["public"]["Tables"]["aso_ebi_guest_orders"]["Row"] & { guests?: { name: string } | null };

const ngn = (n: number) => `₦${Number(n).toLocaleString()}`;

function AsoEbiInner() {
  const { id: eventId } = useParams();
  const [eventName, setEventName] = useState("Event");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [guestOrders, setGuestOrders] = useState<GuestOrder[]>([]);
  const [guests, setGuests] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState({ fabric_type: "", colors: "", qty_estimate: "", budget_per_unit: "", deadline: "", requirements: "" });
  const [quoteDraft, setQuoteDraft] = useState({ provider_id: "", fabric: "", price_per_unit: "", min_order: "1", delivery_days: "", notes: "" });
  const [quoteOpen, setQuoteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const [{ data: ev }, { data: camps }, { data: provs }] = await Promise.all([
      supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
      supabase.from("aso_ebi_campaigns").select("*").eq("event_id", eventId).limit(1),
      supabase.from("aso_ebi_providers").select("*").order("vetted", { ascending: false }).order("rating", { ascending: false }),
    ]);
    setEventName(ev?.name ?? "Event");
    setProviders((provs ?? []) as Provider[]);
    const camp = (camps?.[0] ?? null) as Campaign | null;
    setCampaign(camp);
    if (camp) {
      const [{ data: qs }, { data: os }, { data: gos }] = await Promise.all([
        supabase.from("aso_ebi_quotes").select("*").eq("campaign_id", camp.id),
        supabase.from("aso_ebi_orders").select("*").eq("campaign_id", camp.id).order("created_at", { ascending: false }),
        supabase.from("aso_ebi_guest_orders").select("*, guests(name)").eq("campaign_id", camp.id),
      ]);
      setQuotes((qs ?? []) as QuoteRow[]);
      setOrders((os ?? []) as OrderRow[]);
      setGuestOrders((gos ?? []) as GuestOrder[]);
    }
    // guest list for the distribution tab
    const { data: lists } = await supabase.from("guest_lists").select("id").eq("event_id", eventId).limit(1);
    if (lists?.[0]) {
      const { data: gs } = await supabase.from("guests").select("id, name").eq("list_id", lists[0].id).order("name");
      setGuests((gs ?? []) as Array<{ id: string; name: string }>);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const createCampaign = async () => {
    if (!eventId) return;
    setBusy("create");
    const { data: auth } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("aso_ebi_campaigns").insert({
      event_id: eventId, owner_id: auth.user!.id, title: `Aso-ebi — ${eventName}`,
      fabric_type: draft.fabric_type || null, colors: draft.colors || null,
      qty_estimate: Number(draft.qty_estimate) || null,
      budget_per_unit: Number(draft.budget_per_unit) || null,
      deadline: draft.deadline || null, requirements: draft.requirements || null,
    }).select("*").single();
    setBusy(null);
    if (error) return toast.error("Could not open the campaign", { description: publicError(error) });
    setCampaign(data as Campaign);
    toast.success("Aso-ebi campaign opened — now send your requirements to vetted providers");
  };

  const providerById = useMemo(() => Object.fromEntries(providers.map((p) => [p.id, p])), [providers]);
  const ranked = useMemo(() => rankQuotes(quotes.filter((q) => q.status !== "rejected")), [quotes]);
  const { best, savingsPerUnit } = useMemo(() => bestQuoteSavings(quotes), [quotes]);
  const dist = useMemo(() => distributionStats(guestOrders), [guestOrders]);

  const recordQuote = async () => {
    if (!campaign || !quoteDraft.provider_id || !quoteDraft.price_per_unit) return toast.error("Provider and price are required");
    setBusy("quote");
    const { data, error } = await supabase.from("aso_ebi_quotes").insert({
      campaign_id: campaign.id, provider_id: quoteDraft.provider_id,
      fabric: quoteDraft.fabric || null, price_per_unit: Number(quoteDraft.price_per_unit),
      min_order: Number(quoteDraft.min_order) || 1,
      delivery_days: Number(quoteDraft.delivery_days) || null, notes: quoteDraft.notes || null,
    }).select("*").single();
    setBusy(null);
    if (error) return toast.error("Could not record that quote", { description: publicError(error) });
    setQuotes((q) => [...q, data as QuoteRow]);
    setQuoteDraft({ provider_id: "", fabric: "", price_per_unit: "", min_order: "1", delivery_days: "", notes: "" });
    setQuoteOpen(false);
    toast.success("Quote added to the comparison grid");
  };

  const acceptQuote = async (quote: QuoteRow) => {
    if (!campaign) return;
    const qty = campaign.qty_estimate ?? quote.min_order;
    setBusy(quote.id);
    const provider = providerById[quote.provider_id];
    const total = qty * quote.price_per_unit;
    // deterministic transaction summary; AI-grade narrative via edge fn when configured
    const others = quotes.filter((q) => q.id !== quote.id);
    const summary =
      `Order: ${qty} units of ${quote.fabric ?? campaign.fabric_type ?? "fabric"} from ${provider?.name ?? "provider"} (${provider?.city ?? "—"}) at ${ngn(quote.price_per_unit)}/unit — total ${ngn(total)}. ` +
      (others.length ? `Chosen over ${others.length} other quote${others.length > 1 ? "s" : ""}; saved ~${ngn(Math.round(savingsPerUnit * qty))} vs market average. ` : "") +
      (quote.delivery_days ? `Delivery in ${quote.delivery_days} days. ` : "") +
      (campaign.deadline ? `Event deadline ${campaign.deadline}.` : "");
    const { data, error } = await supabase.from("aso_ebi_orders").insert({
      campaign_id: campaign.id, quote_id: quote.id,
      provider_name: provider?.name ?? "Provider", fabric: quote.fabric,
      qty, unit_price: quote.price_per_unit, total, ai_summary: summary,
    }).select("*").single();
    if (!error) await supabase.from("aso_ebi_quotes").update({ status: "accepted" }).eq("id", quote.id);
    setBusy(null);
    if (error) return toast.error("Could not create that order", { description: publicError(error) });
    setOrders((o) => [data as OrderRow, ...o]);
    setQuotes((qs) => qs.map((q) => (q.id === quote.id ? { ...q, status: "accepted" } : q)));
    toast.success("Order created — proceed to payment in the Orders tab");
  };

  const payOrder = async (order: OrderRow) => {
    setBusy(order.id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("zonicme-payment", {
        body: { action: "initialize", plan: `asoebi:${order.id}`, email: auth.user?.email, redirect_base: window.location.href.split("?")[0] },
      });
      if (error) throw error;
      const resp = data as { checkoutUrl?: string; error?: string };
      if (resp?.checkoutUrl) window.location.href = resp.checkoutUrl;
      else toast.error("Checkout unavailable", {
        description: publicError(
          resp?.error,
          "Card checkout isn't available right now. You can pay the provider by transfer and mark this order paid.",
        ),
      });
    } catch (e) {
      toast.error("Couldn't start checkout", {
        description: publicError(e, "Card checkout isn't available right now. Please try again shortly."),
      });
    }
    setBusy(null);
  };

  const markOrderPaid = async (order: OrderRow) => {
    setBusy(order.id);
    const { error } = await supabase.from("aso_ebi_orders").update({ payment_status: "paid", payment_provider: "manual_transfer" }).eq("id", order.id);
    setBusy(null);
    if (error) return toast.error("Couldn't mark that order paid", { description: publicError(error) });
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, payment_status: "paid" } : o)));
    toast.success("Order marked paid", {
      description: `Recorded as a manual transfer at ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`,
    });
  };

  const addGuestOrder = async (guestId: string) => {
    if (!campaign) return;
    const unit = best?.price_per_unit ?? campaign.budget_per_unit ?? 0;
    const { data, error } = await supabase.from("aso_ebi_guest_orders")
      .insert({ campaign_id: campaign.id, guest_id: guestId, qty: 1, amount: unit })
      .select("*, guests(name)").single();
    if (error) {
      // A duplicate is the one case the visitor can act on, so it keeps its
      // own message instead of being flattened into the generic error.
      return error.message.includes("duplicate")
        ? toast.error("That guest is already on the aso-ebi list")
        : toast.error("Couldn't add that guest", { description: publicError(error) });
    }
    setGuestOrders((g) => [...g, data as GuestOrder]);
  };

  const updateGuestOrder = async (id: string, patch: Partial<GuestOrder>) => {
    const { error } = await supabase.from("aso_ebi_guest_orders").update(patch).eq("id", id);
    if (error) return toast.error("Couldn't save that change", { description: publicError(error) });
    setGuestOrders((g) => g.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <Link to={`/events/${eventId}`} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> {eventName}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mt-1 flex items-center gap-2"><Crown className="w-6 h-6 text-primary" /> Aso-ebi portal</h1>
      </div>

      {!campaign ? (
        <Card className="max-w-2xl">
          <CardHeader><CardTitle>Describe your aso-ebi once — send it to every vetted provider</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Fabric type (e.g. Swiss lace)" value={draft.fabric_type} onChange={(e) => setDraft({ ...draft, fabric_type: e.target.value })} />
              <Input placeholder="Colours (e.g. emerald & gold)" value={draft.colors} onChange={(e) => setDraft({ ...draft, colors: e.target.value })} />
              <Input type="number" placeholder="Quantity estimate" value={draft.qty_estimate} onChange={(e) => setDraft({ ...draft, qty_estimate: e.target.value })} />
              <Input type="number" placeholder="Budget per unit (₦)" value={draft.budget_per_unit} onChange={(e) => setDraft({ ...draft, budget_per_unit: e.target.value })} />
            </div>
            <Input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />
            <Textarea placeholder="Extra requirements (gele bundles, swatches first, sewing coordination…)" value={draft.requirements} onChange={(e) => setDraft({ ...draft, requirements: e.target.value })} />
            <Button onClick={createCampaign} disabled={busy === "create"} className="w-full">
              {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Open aso-ebi campaign"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="providers">
          <TabsList>
            <TabsTrigger value="providers"><ShieldCheck className="w-4 h-4 mr-1" /> Vetted providers</TabsTrigger>
            <TabsTrigger value="quotes"><Star className="w-4 h-4 mr-1" /> Compare quotes ({ranked.length})</TabsTrigger>
            <TabsTrigger value="orders"><ShoppingBag className="w-4 h-4 mr-1" /> Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="distribution"><Users className="w-4 h-4 mr-1" /> Guest distribution</TabsTrigger>
          </TabsList>

          {/* ── Vetted providers + one-tap WhatsApp RFQ ── */}
          <TabsContent value="providers" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Your requirements are pre-written — tap WhatsApp on any provider and the full RFQ is in the message box. Record their replies in the quotes grid.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {providers.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold flex items-center gap-1.5">
                          {p.name}
                          {p.vetted && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"><BadgeCheck className="w-3 h-3 mr-0.5" /> Vetted</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">{p.city} · {p.specialties}</p>
                        {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                      </div>
                      {p.rating != null && <span className="text-sm font-semibold flex items-center gap-1"><Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> {p.rating}</span>}
                    </div>
                    <div className="flex gap-2 mt-4">
                      {p.whatsapp && (
                        <Button asChild size="sm" variant="outline">
                          <a target="_blank" rel="noreferrer"
                            href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(rfqMessage(campaign, eventName))}`}>
                            <MessageCircle className="w-4 h-4 mr-1" /> Send RFQ on WhatsApp
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setQuoteDraft((d) => ({ ...d, provider_id: p.id })); setQuoteOpen(true); }}>
                        Record their quote
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── Comparison grid ── */}
          <TabsContent value="quotes" className="space-y-4 pt-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              {best && (
                <p className="text-sm">
                  Best: <span className="font-semibold">{providerById[best.provider_id]?.name}</span> at <span className="font-semibold">{ngn(best.price_per_unit)}/unit</span>
                  {savingsPerUnit > 0 && <span className="text-emerald-600"> — saves {ngn(Math.round(savingsPerUnit))}/unit vs average</span>}
                </p>
              )}
              <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
                <DialogTrigger asChild><Button size="sm">Record a quote</Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Record a provider's quote</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <select className="w-full border rounded-md h-10 px-3 text-sm bg-background" value={quoteDraft.provider_id} onChange={(e) => setQuoteDraft({ ...quoteDraft, provider_id: e.target.value })}>
                      <option value="">Choose provider…</option>
                      {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Fabric quoted" value={quoteDraft.fabric} onChange={(e) => setQuoteDraft({ ...quoteDraft, fabric: e.target.value })} />
                      <Input type="number" placeholder="Price per unit (₦) *" value={quoteDraft.price_per_unit} onChange={(e) => setQuoteDraft({ ...quoteDraft, price_per_unit: e.target.value })} />
                      <Input type="number" placeholder="Minimum order" value={quoteDraft.min_order} onChange={(e) => setQuoteDraft({ ...quoteDraft, min_order: e.target.value })} />
                      <Input type="number" placeholder="Delivery (days)" value={quoteDraft.delivery_days} onChange={(e) => setQuoteDraft({ ...quoteDraft, delivery_days: e.target.value })} />
                    </div>
                    <Input placeholder="Notes (swatch sent, discount above 50…)" value={quoteDraft.notes} onChange={(e) => setQuoteDraft({ ...quoteDraft, notes: e.target.value })} />
                    <Button className="w-full" onClick={recordQuote} disabled={busy === "quote"}>Add to comparison grid</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No quotes yet — send the RFQ to providers, then record their replies here.</p>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Provider</TableHead><TableHead>Fabric</TableHead>
                    <TableHead className="text-right">₦ / unit</TableHead>
                    <TableHead className="text-right">Min order</TableHead>
                    <TableHead className="text-right">Delivery</TableHead>
                    <TableHead className="text-right">Est. total ({campaign.qty_estimate ?? "?"} units)</TableHead>
                    <TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {ranked.map((q, i) => {
                      const p = providerById[q.provider_id];
                      return (
                        <TableRow key={q.id} className={i === 0 ? "bg-emerald-50/60" : undefined}>
                          <TableCell>
                            <p className="font-medium flex items-center gap-1">{p?.name}{i === 0 && <Badge className="bg-emerald-600 text-white text-[10px]">Best</Badge>}</p>
                            <p className="text-xs text-muted-foreground">{p?.city}{q.notes ? ` · ${q.notes}` : ""}</p>
                          </TableCell>
                          <TableCell className="text-sm">{q.fabric ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{ngn(q.price_per_unit)}</TableCell>
                          <TableCell className="text-right">{q.min_order}</TableCell>
                          <TableCell className="text-right">{q.delivery_days ? `${q.delivery_days}d` : "—"}</TableCell>
                          <TableCell className="text-right">{campaign.qty_estimate ? ngn(q.price_per_unit * campaign.qty_estimate) : "—"}</TableCell>
                          <TableCell>
                            {q.status === "accepted"
                              ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300"><Check className="w-3 h-3 mr-1" />Ordered</Badge>
                              : <Button size="sm" onClick={() => acceptQuote(q)} disabled={busy === q.id}>Accept & order</Button>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ── Orders + AI summaries + payment ── */}
          <TabsContent value="orders" className="space-y-4 pt-4">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Accept a quote from the comparison grid to create your first order.</p>
            ) : orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold">{o.provider_name} — {o.qty} × {o.fabric ?? "fabric"}</p>
                      <p className="text-sm text-muted-foreground">{ngn(o.unit_price)}/unit · total <span className="font-semibold text-foreground">{ngn(o.total)}</span></p>
                    </div>
                    {o.payment_status === "paid"
                      ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300"><Check className="w-3 h-3 mr-1" /> Paid{o.payment_provider ? ` · ${o.payment_provider}` : ""}</Badge>
                      : (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => payOrder(o)} disabled={busy === o.id}>Pay now (Flutterwave / Paystack)</Button>
                          <Button size="sm" variant="outline" onClick={() => markOrderPaid(o)} disabled={busy === o.id}>Mark paid by transfer</Button>
                        </div>
                      )}
                  </div>
                  {o.ai_summary && (
                    <div className="bg-muted/60 rounded-lg p-3 text-sm flex gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p>{o.ai_summary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── Guest distribution tied to the guest list ── */}
          <TabsContent value="distribution" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                ["Buyers", dist.buyers], ["Units", dist.units], ["Expected", ngn(dist.expected)],
                ["Paid", ngn(dist.paid)], ["Outstanding", ngn(dist.outstanding)], ["Collected", `${dist.collected}/${dist.buyers}`],
              ].map(([l, v]) => (
                <Card key={String(l)}><CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{l}</p>
                  <p className="text-lg font-bold">{v}</p>
                </CardContent></Card>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select className="border rounded-md h-9 px-3 text-sm bg-background" defaultValue="" onChange={(e) => { if (e.target.value) { addGuestOrder(e.target.value); e.target.value = ""; } }}>
                <option value="" disabled>Add guest to aso-ebi…</option>
                {guests.filter((g) => !guestOrders.some((go) => go.guest_id === g.id)).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Guests come straight from your guest list. Price defaults to your best quote.</p>
            </div>
            {guestOrders.length > 0 && (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Guest</TableHead><TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead><TableHead>Measurements</TableHead>
                    <TableHead>Paid</TableHead><TableHead>Collected</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {guestOrders.map((go) => (
                      <TableRow key={go.id} className={!go.paid ? "bg-red-50/40" : undefined}>
                        <TableCell className="font-medium">{go.guests?.name ?? "Guest"}</TableCell>
                        <TableCell className="text-center">
                          <Input type="number" min={1} className="h-8 w-16 mx-auto text-center" value={go.qty}
                            onChange={(e) => updateGuestOrder(go.id, { qty: Number(e.target.value) || 1, amount: (Number(e.target.value) || 1) * (best?.price_per_unit ?? go.amount / Math.max(1, go.qty)) })} />
                        </TableCell>
                        <TableCell className="text-right font-medium">{ngn(go.amount)}</TableCell>
                        <TableCell>
                          <Input className="h-8 text-xs" placeholder="Bust/waist/length…" value={go.measurements ?? ""}
                            onChange={(e) => updateGuestOrder(go.id, { measurements: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant={go.paid ? "default" : "outline"} className="h-7 text-xs"
                            onClick={() => updateGuestOrder(go.id, { paid: !go.paid })}>
                            {go.paid ? "Paid ✓" : "Mark paid"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant={go.collected ? "default" : "outline"} className="h-7 text-xs"
                            onClick={() => updateGuestOrder(go.id, { collected: !go.collected })}>
                            {go.collected ? "Collected ✓" : "Pending"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function AsoEbi() {
  const { id } = useParams();
  return (
    <GateGuard service="aso_ebi" eventId={id} featureName="Aso-ebi management">
      <AsoEbiInner />
    </GateGuard>
  );
}
