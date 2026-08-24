import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Eye, Heart, MessageCircle, Mail, Phone, TrendingUp, Receipt, Calendar, ExternalLink } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { BrandCatalogTab } from "@/components/BrandCatalogTab";
import { BrandFunnelTab } from "@/components/BrandFunnelTab";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Brand = { id: string; name: string; status: string; logo_url: string | null };
type Vendor = { id: string; name: string; category: string };
type EventRow = { vendor_id: string; event_type: string; created_at: string };
type Subscription = { id: string; plan: string; status: string; period_end: string; amount: number; is_waived: boolean };
type Payment = { id: string; amount: number; status: string; method: string; paid_at: string | null; external_ref: string | null; created_at: string };

const RANGES = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 } as const;
type Range = keyof typeof RANGES;

export default function BrandDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [range, setRange] = useState<Range>("30d");

  useEffect(() => { document.title = "Brand dashboard — OwanbeX"; }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoading(true);
        const { data: b } = await supabase.from("brands").select("id, name, status, logo_url").eq("owner_id", user.id).maybeSingle();
        if (!b) { setLoading(false); return; }
        setBrand(b as Brand);

        const since = new Date(Date.now() - RANGES[range] * 86_400_000).toISOString();
        const [{ data: bv }, { data: s }, { data: p }] = await Promise.all([
          supabase.from("brand_vendors").select("vendor_id, vendors(id, name, category)").eq("brand_id", b.id),
          supabase.from("brand_subscriptions").select("*").eq("brand_id", b.id).order("created_at", { ascending: false }),
          supabase.from("brand_payments").select("*").eq("brand_id", b.id).order("created_at", { ascending: false }),
        ]);
        const vlist = (bv ?? []).map((r: { vendors: unknown }) => r.vendors).filter(Boolean) as Vendor[];
        setVendors(vlist);
        setSubs((s ?? []) as Subscription[]);
        setPayments((p ?? []) as Payment[]);

        if (vlist.length) {
          const { data: ev } = await supabase
            .from("vendor_analytics_events")
            .select("vendor_id, event_type, created_at")
            .in("vendor_id", vlist.map((v) => v.id))
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(5000);
          setEvents((ev ?? []) as EventRow[]);
        } else {
          setEvents([]);
        }
      } catch {
        setBrand(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, range]);

  const stats = useMemo(() => {
    const acc = { view: 0, shortlist_add: 0, contact_whatsapp: 0, contact_email: 0, contact_phone: 0 };
    for (const e of events) (acc as Record<string, number>)[e.event_type] = ((acc as Record<string, number>)[e.event_type] ?? 0) + 1;
    return acc;
  }, [events]);

  const daily = useMemo(() => {
    const days = RANGES[range];
    const map = new Map<string, { date: string; views: number; shortlists: number; contacts: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      map.set(d, { date: d, views: 0, shortlists: 0, contacts: 0 });
    }
    for (const e of events) {
      const d = e.created_at.slice(0, 10);
      const row = map.get(d); if (!row) continue;
      if (e.event_type === "view") row.views++;
      else if (e.event_type === "shortlist_add") row.shortlists++;
      else row.contacts++;
    }
    return [...map.values()];
  }, [events, range]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppShell>
      <div className="container py-6 md:py-10 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl md:text-4xl">{brand?.name ?? "Brand dashboard"}</h1>
            <p className="text-muted-foreground">Insights, subscription and billing for your brand.</p>
          </div>
          {brand && <Badge variant="secondary" className="capitalize">{brand.status.replace("_", " ")}</Badge>}
        </header>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        ) : !brand ? (
          <Card><CardContent className="p-8 text-center space-y-3">
            <p>You don't have a brand yet.</p>
            <Button asChild><Link to="/brand/onboarding">Become a brand</Link></Button>
          </CardContent></Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RANGES) as Range[]).map((k) => (
                <Button key={k} size="sm" variant={range === k ? "default" : "outline"} onClick={() => setRange(k)}>
                  {k.replace("d", " days")}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={Eye} label="Profile views" value={stats.view} />
              <Stat icon={Heart} label="Shortlist adds" value={stats.shortlist_add} />
              <Stat icon={MessageCircle} label="WhatsApp clicks" value={stats.contact_whatsapp} />
              <Stat icon={Mail} label="Email clicks" value={stats.contact_email} hint={`+ ${stats.contact_phone} phone`} />
            </div>

            <Tabs defaultValue="performance" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="funnel">Funnel & AI</TabsTrigger>
                <TabsTrigger value="catalog">Catalog</TabsTrigger>
                <TabsTrigger value="vendors">My listings ({vendors.length})</TabsTrigger>
                <TabsTrigger value="billing">Billing & invoices</TabsTrigger>
              </TabsList>

              <TabsContent value="funnel"><BrandFunnelTab brandId={brand.id} vendorIds={vendors.map(v => v.id)} /></TabsContent>
              <TabsContent value="catalog"><BrandCatalogTab brandId={brand.id} vendorIds={vendors.map(v => v.id)} /></TabsContent>

              <TabsContent value="performance">
                <div className="grid lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Daily activity</CardTitle></CardHeader>
                    <CardContent className="h-72">
                      <Sparkline data={daily} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-base">Mix</CardTitle></CardHeader>
                    <CardContent className="h-72">
                      <MixPie stats={stats} />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="vendors">
                {vendors.length === 0 ? (
                  <Card><CardContent className="p-6 text-sm text-muted-foreground">
                    No vendor listings linked yet. Once approved, an admin will link your vendor profile(s) here.
                  </CardContent></Card>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {vendors.map((v) => (
                      <Card key={v.id}>
                        <CardContent className="p-4 space-y-1">
                          <div className="font-medium">{v.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{v.category.replace(/_/g, " ")}</div>
                          <Button variant="link" size="sm" asChild className="px-0 h-auto">
                            <Link to={`/vendors/${v.id}`}>View public profile <ExternalLink className="h-3 w-3 ml-1" /></Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="billing" className="space-y-4">
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Subscriptions</CardTitle></CardHeader>
                  <CardContent>
                    {subs.length === 0 ? <p className="text-sm text-muted-foreground">No subscriptions yet.</p> : (
                      <div className="space-y-2">
                        {subs.map((s) => (
                          <div key={s.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                            <div>
                              <span className="font-medium capitalize">{s.plan}</span>
                              {s.is_waived && <Badge variant="outline" className="ml-2">Waived</Badge>}
                              <div className="text-xs text-muted-foreground">until {new Date(s.period_end).toLocaleDateString()}</div>
                            </div>
                            <div className="text-right">
                              <div>{formatNaira(s.amount)}</div>
                              <Badge variant="secondary" className="text-xs">{s.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> Payments</CardTitle></CardHeader>
                  <CardContent>
                    {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded.</p> : (
                      <div className="space-y-2">
                        {payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between border-b last:border-0 py-2 text-sm">
                            <div>
                              <div>{formatNaira(p.amount)}</div>
                              <div className="text-xs text-muted-foreground">
                                {(p.paid_at ?? p.created_at).slice(0, 10)} · {p.method} · {p.external_ref ?? "—"}
                              </div>
                            </div>
                            <Badge variant={p.status === "succeeded" ? "default" : p.status === "waived" ? "outline" : "secondary"}>{p.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; hint?: string }) {
  return (
    <Card><CardContent className="p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="text-2xl font-display">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </CardContent></Card>
  );
}

function Sparkline({ data }: { data: { date: string; views: number; shortlists: number; contacts: number }[] }) {
  const series = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A227" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#C9A227" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="shortFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7B1E2C" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#7B1E2C" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} width={32} />
        <Tooltip />
        <Area type="monotone" dataKey="views" name="Views" stroke="#C9A227" fill="url(#viewsFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="shortlists" name="Shortlists" stroke="#7B1E2C" fill="url(#shortFill)" strokeWidth={2} />
        <Area type="monotone" dataKey="contacts" name="Contacts" stroke="#2A6F4D" fill="#2A6F4D22" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MixPie({ stats }: { stats: { view: number; shortlist_add: number; contact_whatsapp: number; contact_email: number; contact_phone: number } }) {
  const pie = [
    { name: "Views", value: stats.view, color: "#C9A227" },
    { name: "Shortlists", value: stats.shortlist_add, color: "#7B1E2C" },
    { name: "WhatsApp", value: stats.contact_whatsapp, color: "#2A6F4D" },
    { name: "Email", value: stats.contact_email, color: "#1E5A8A" },
    { name: "Phone", value: stats.contact_phone, color: "#4F3A78" },
  ].filter((d) => d.value > 0);
  const data = pie.length ? pie : [{ name: "Views", value: 1, color: "#C9A227" }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
