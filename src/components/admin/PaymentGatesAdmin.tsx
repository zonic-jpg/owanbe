import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Lock, LockOpen, ShieldAlert } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Gate = Database["public"]["Tables"]["service_gates"]["Row"];
type Audit = Database["public"]["Tables"]["service_gate_audit"]["Row"];

const MODELS = [
  { v: "one_off", l: "One-off" }, { v: "per_event", l: "Per event" }, { v: "subscription", l: "Subscription" },
];

/** Super-admin monetization control panel. Each major service is an
 *  independently priced, independently gated module — flip a gate, set a
 *  price/model, and every client enforces it on next page load. Every change
 *  is written to the gate audit trail so pricing moves can be correlated
 *  with uptake. */
export function PaymentGatesAdmin() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { price: string; model: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: gs }, { data: au }] = await Promise.all([
      supabase.from("service_gates").select("*").order("service"),
      supabase.from("service_gate_audit").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    const list = (gs ?? []) as Gate[];
    setGates(list);
    setDrafts(Object.fromEntries(list.map((g) => [g.service, { price: String(g.price), model: g.model }])));
    setAudit((au ?? []) as Audit[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async (g: Gate, enabled: boolean) => {
    setBusy(g.service);
    const d = drafts[g.service] ?? { price: String(g.price), model: g.model };
    const newVal = { enabled, price: Number(d.price) || 0, model: d.model };
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("service_gates")
      .update({ ...newVal, updated_by: auth.user?.id ?? null, updated_at: new Date().toISOString() })
      .eq("service", g.service);
    if (!error) {
      await supabase.from("service_gate_audit").insert({
        service: g.service,
        action: enabled === g.enabled ? "updated" : enabled ? "enabled" : "disabled",
        old_value: { enabled: g.enabled, price: g.price, model: g.model },
        new_value: newVal,
        actor: auth.user?.id ?? null,
      });
    }
    setBusy(null);
    if (error) return toast.error("Save failed", { description: error.message });
    toast.success(`${g.label}: gate ${enabled ? "ON" : "OFF"} at ₦${Number(d.price).toLocaleString()} (${d.model.replace("_", "-")})`);
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/60 rounded-lg p-3">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <p>Gates take effect platform-wide on users' next page load — no deploy needed. Turning a gate <b>on</b> immediately shows an unlock prompt with live checkout to any user who hasn't paid. Every change is audited below.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {gates.map((g) => {
          const d = drafts[g.service] ?? { price: String(g.price), model: g.model };
          return (
            <Card key={g.service} className={g.enabled ? "border-primary/40" : undefined}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {g.enabled ? <Lock className="w-4 h-4 text-primary" /> : <LockOpen className="w-4 h-4 text-muted-foreground" />}
                    <p className="font-semibold">{g.label}</p>
                  </div>
                  <Badge variant={g.enabled ? "default" : "outline"}>{g.enabled ? "GATED" : "FREE"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Price (₦)</p>
                    <Input type="number" min={0} value={d.price}
                      onChange={(e) => setDrafts((x) => ({ ...x, [g.service]: { ...d, price: e.target.value } }))} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Model</p>
                    <Select value={d.model} onValueChange={(v) => setDrafts((x) => ({ ...x, [g.service]: { ...d, model: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MODELS.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={g.enabled} onCheckedChange={(v) => save(g, v)} disabled={busy === g.service} />
                    <span className="text-sm text-muted-foreground">{g.enabled ? "Payment required" : "Free for everyone"}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => save(g, g.enabled)} disabled={busy === g.service}>
                    {busy === g.service ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save price/model"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h3 className="font-semibold text-sm mb-2">Gate change history</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes yet.</p>
        ) : (
          <div className="space-y-1.5">
            {audit.map((a) => {
              const nv = (a.new_value ?? {}) as { enabled?: boolean; price?: number; model?: string };
              return (
                <div key={a.id} className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{new Date(a.created_at).toLocaleString()}</Badge>
                  <span className="font-medium text-foreground">{a.service}</span>
                  <span>{a.action}</span>
                  {nv.price != null && <span>→ ₦{Number(nv.price).toLocaleString()} ({String(nv.model ?? "").replace("_", "-")})</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
