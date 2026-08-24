import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, Wallet, Users, Crown } from "lucide-react";
import { formatNaira, formatNairaCompact } from "@/lib/format";

type Payment = { id: string; amount: number; status: string; paid_at: string | null; created_at: string; brand_id: string };
type Sub = { id: string; brand_id: string; plan: string; status: string; amount: number; period_end: string; is_waived: boolean };

export function FinancialsAdmin() {
  const { canViewFinancials } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);

  useEffect(() => {
    if (!canViewFinancials) return;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("brand_payments").select("id, amount, status, paid_at, created_at, brand_id").eq("status", "succeeded").order("paid_at", { ascending: false }).limit(1000),
        supabase.from("brand_subscriptions").select("id, brand_id, plan, status, amount, period_end, is_waived").limit(1000),
      ]);
      setPayments((p ?? []) as Payment[]);
      setSubs((s ?? []) as Sub[]);
      setLoading(false);
    })();
  }, [canViewFinancials]);

  const summary = useMemo(() => {
    const now = Date.now();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const yearStart = new Date(); yearStart.setMonth(0, 1); yearStart.setHours(0, 0, 0, 0);

    const month = payments.filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart).reduce((s, p) => s + p.amount, 0);
    const year = payments.filter((p) => p.paid_at && new Date(p.paid_at) >= yearStart).reduce((s, p) => s + p.amount, 0);
    const allTime = payments.reduce((s, p) => s + p.amount, 0);

    const activeSubs = subs.filter((s) => s.status === "active" && new Date(s.period_end).getTime() > now);
    const waivedSubs = subs.filter((s) => s.status === "waived" && new Date(s.period_end).getTime() > now);

    // MRR: monthly subs amount + annual subs amount/12
    const mrr = activeSubs.reduce((sum, s) => sum + (s.plan === "annual" ? s.amount / 12 : s.amount), 0);
    const arr = mrr * 12;

    // Monthly buckets for last 12 months
    const buckets = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0);
      buckets.set(d.toISOString().slice(0, 7), 0);
    }
    for (const p of payments) {
      if (!p.paid_at) continue;
      const k = p.paid_at.slice(0, 7);
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + p.amount);
    }
    const monthly = [...buckets.entries()].map(([k, v]) => ({ month: k, total: v }));

    return { month, year, allTime, mrr, arr, activeCount: activeSubs.length, waivedCount: waivedSubs.length, monthly };
  }, [payments, subs]);

  if (!canViewFinancials) {
    return (
      <Card><CardContent className="p-8 text-center space-y-2">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
        <p className="font-medium">You don't have permission to view financials.</p>
        <p className="text-sm text-muted-foreground">Ask a super admin to grant you the <code>view_financials</code> permission.</p>
      </CardContent></Card>
    );
  }

  if (loading) return <Skeleton className="h-96 w-full" />;

  const max = Math.max(1, ...summary.monthly.map((m) => m.total));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Wallet} label="This month" value={formatNaira(summary.month)} />
        <Stat icon={TrendingUp} label="This year" value={formatNaira(summary.year)} />
        <Stat icon={TrendingUp} label="MRR" value={formatNairaCompact(summary.mrr)} hint={`ARR ${formatNairaCompact(summary.arr)}`} />
        <Stat icon={Users} label="Active subs" value={String(summary.activeCount)} hint={`${summary.waivedCount} waived`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue — last 12 months</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-48">
            {summary.monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5" title={`${m.month}: ${formatNaira(m.total)}`}>
                <div className="w-full rounded-t bg-primary/80 transition-all" style={{ height: `${Math.max(2, (m.total / max) * 100)}%` }} />
                <div className="text-[10px] text-muted-foreground">{m.month.slice(5)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent payments</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : (
            <div className="space-y-1.5">
              {payments.slice(0, 25).map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b last:border-0 py-1.5 text-sm">
                  <span className="font-mono text-xs text-muted-foreground truncate">{p.brand_id.slice(0, 8)}…</span>
                  <span>{formatNaira(p.amount)}</span>
                  <span className="text-xs text-muted-foreground">{(p.paid_at ?? p.created_at).slice(0, 10)}</span>
                  <Badge variant="default" className="text-xs">{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="h-4 w-4" /> All-time revenue</CardTitle></CardHeader>
        <CardContent><div className="text-3xl font-display">{formatNaira(summary.allTime)}</div></CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
  return (
    <Card><CardContent className="p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="text-xl font-display">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </CardContent></Card>
  );
}
