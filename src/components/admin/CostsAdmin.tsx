import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Info } from "lucide-react";

/**
 * Live running-cost oversight for the app's external API dependencies.
 *
 * Rates are editable and persisted to localStorage so they survive reloads.
 * Volumes for a few items are pulled live (e.g. vendor count); the rest are
 * estimates you set. Everything is converted to Naira using the FX rate below
 * so you get one running monthly total. This is an estimate to confirm against
 * each provider's actual invoice — it is not a billing integration.
 */

type Row = {
  id: string;
  service: string;
  note: string;
  // "fixed" = flat monthly; "unit" = rate per call/item × volume
  kind: "fixed" | "unit";
  currency: "USD" | "NGN";
  rate: number; // monthly amount (fixed) or per-unit (unit)
  volume: number; // for unit rows
  unitLabel: string;
  live?: boolean; // volume is auto-pulled
};

const STORAGE_KEY = "owanbe.costmodel.v1";

const DEFAULT_FX = 1600; // ₦ per US$ — editable

const DEFAULT_ROWS: Row[] = [
  { id: "supabase", service: "Supabase (DB, auth, storage)", note: "Database, logins, storage, server functions (Pro plan base)", kind: "fixed", currency: "USD", rate: 25, volume: 0, unitLabel: "month" },
  { id: "supabase_compute", service: "Supabase compute add-on", note: "Larger instance once traffic grows (₦0 until needed)", kind: "fixed", currency: "USD", rate: 0, volume: 0, unitLabel: "month" },
  { id: "ai_summaries", service: "AI summaries (your AI provider)", note: "Event + brand AI write-ups — set your provider rate", kind: "unit", currency: "USD", rate: 0.0015, volume: 500, unitLabel: "summaries" },
  { id: "ai_covers", service: "AI cover images (your AI provider)", note: "Vendor cover generation (volume ≈ vendor count, live)", kind: "unit", currency: "USD", rate: 0.04, volume: 0, unitLabel: "images", live: true },
  { id: "email", service: "Email (Supabase Auth)", note: "Verification / reset emails — free within plan limits", kind: "fixed", currency: "USD", rate: 0, volume: 0, unitLabel: "month" },
  { id: "oauth", service: "Google sign-in (Supabase OAuth)", note: "OAuth — no per-use charge", kind: "fixed", currency: "USD", rate: 0, volume: 0, unitLabel: "month" },
];

// Paystack/Flutterwave fee model (Nigeria, local cards).
type Pay = { provider: string; percent: number; flat: number; cap: number; vat: number; avg: number; txns: number };
const DEFAULT_PAY: Pay = { provider: "Paystack", percent: 1.5, flat: 100, cap: 2000, vat: 7.5, avg: 100000, txns: 0 };

function naira(n: number) {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

function payFeePerTxn(p: Pay): number {
  const base = (p.avg * p.percent) / 100 + p.flat;
  const capped = Math.min(base, p.cap);
  return capped * (1 + p.vat / 100);
}

export function CostsAdmin() {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [pay, setPay] = useState<Pay>(DEFAULT_PAY);
  const [fx, setFx] = useState<number>(DEFAULT_FX);
  const [loadingCounts, setLoadingCounts] = useState(false);

  // Load saved model.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.rows) setRows(saved.rows);
        if (saved.pay) setPay(saved.pay);
        if (typeof saved.fx === "number") setFx(saved.fx);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, pay, fx }));
    } catch {
      /* ignore */
    }
  }, [rows, pay, fx]);

  const pullLiveCounts = async () => {
    setLoadingCounts(true);
    try {
      const { count } = await supabase
        .from("vendors")
        .select("id", { count: "exact", head: true });
      if (typeof count === "number") {
        setRows((prev) => prev.map((r) => (r.live ? { ...r, volume: count } : r)));
      }
    } catch {
      /* leave volumes as-is if the query fails */
    } finally {
      setLoadingCounts(false);
    }
  };

  useEffect(() => {
    void pullLiveCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toNaira = (amount: number, ccy: "USD" | "NGN") => (ccy === "USD" ? amount * fx : amount);

  const rowMonthly = (r: Row) => (r.kind === "fixed" ? r.rate : r.rate * r.volume);

  const apiTotalNaira = useMemo(
    () => rows.reduce((sum, r) => sum + toNaira(rowMonthly(r), r.currency), 0),
    [rows, fx],
  );

  const payMonthlyNaira = useMemo(() => payFeePerTxn(pay) * pay.txns, [pay]);
  const grandTotal = apiTotalNaira + payMonthlyNaira;

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Estimated running cost across the app's outside services. Rates are editable and saved on
          this device. Volumes marked <Badge variant="secondary" className="mx-1">live</Badge> are
          pulled from your data; the rest are figures you set. Always confirm against each provider's
          actual invoice.
        </p>
      </div>

      {/* FX + refresh */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">FX rate (₦ per US$1)</label>
          <Input
            type="number"
            value={fx}
            onChange={(e) => setFx(Number(e.target.value) || 0)}
            className="w-36 h-9 mt-1"
          />
        </div>
        <Button variant="outline" size="sm" onClick={pullLiveCounts} disabled={loadingCounts} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loadingCounts ? "animate-spin" : ""}`} /> Refresh live volumes
        </Button>
      </div>

      {/* API cost table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cloud &amp; AI services</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="py-2 pr-4">Service</th>
                <th className="py-2 pr-4">Rate</th>
                <th className="py-2 pr-4">Volume / mo</th>
                <th className="py-2 pr-4 text-right">Monthly (₦)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{r.service}</div>
                    <div className="text-xs text-muted-foreground">{r.note}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">{r.currency === "USD" ? "$" : "₦"}</span>
                      <Input
                        type="number"
                        step="0.0001"
                        value={r.rate}
                        onChange={(e) => setRow(r.id, { rate: Number(e.target.value) || 0 })}
                        className="w-24 h-8"
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.kind === "fixed" ? "per month" : `per ${r.unitLabel.replace(/s$/, "")}`}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {r.kind === "unit" ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={r.volume}
                          onChange={(e) => setRow(r.id, { volume: Number(e.target.value) || 0 })}
                          className="w-24 h-8"
                          disabled={r.live}
                        />
                        {r.live && <Badge variant="secondary">live</Badge>}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-medium tabular-nums">
                    {naira(toNaira(rowMonthly(r), r.currency))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <td className="py-3 pr-4 font-semibold" colSpan={3}>
                  Cloud &amp; AI subtotal
                </td>
                <td className="py-3 pr-4 text-right font-semibold tabular-nums">{naira(apiTotalNaira)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Payment processor fees */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment processing ({pay.provider})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              ["percent", "Fee %", pay.percent],
              ["flat", "Flat (₦)", pay.flat],
              ["cap", "Cap (₦)", pay.cap],
              ["vat", "VAT %", pay.vat],
              ["avg", "Avg txn (₦)", pay.avg],
              ["txns", "Txns / mo", pay.txns],
            ] as [keyof Pay, string, number][]).map(([key, label, val]) => (
              <div key={key}>
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <Input
                  type="number"
                  value={val}
                  onChange={(e) => setPay({ ...pay, [key]: Number(e.target.value) || 0 })}
                  className="h-9 mt-1"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              Fee per transaction: <span className="font-medium text-foreground">{naira(payFeePerTxn(pay))}</span>{" "}
              (incl. {pay.vat}% VAT, capped at {naira(pay.cap)})
            </span>
            <span className="font-semibold tabular-nums">Monthly fees: {naira(payMonthlyNaira)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Flutterwave equivalent: 1.4% + ₦100, same ₦2,000 cap — switch the figures above to compare.
            These are processing fees on money you collect, not a fixed bill.
          </p>
        </CardContent>
      </Card>

      {/* Grand total */}
      <Card className="border-primary/40">
        <CardContent className="py-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Estimated total running cost</div>
            <div className="text-xs text-muted-foreground">Cloud &amp; AI + payment fees, per month</div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-primary tabular-nums">{naira(grandTotal)}</div>
        </CardContent>
      </Card>
    </div>
  );
}
