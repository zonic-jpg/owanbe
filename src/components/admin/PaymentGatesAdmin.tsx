import { useEffect, useState } from "react";
import {
  OWANBE_SERVICE_CATALOG,
  activateServicePricing,
  getServiceDraft,
  isServicePricingVisible,
  listActiveServicePricing,
  saveServiceDraft,
  toGateFields,
  type ServicePricingMode,
} from "@/lib/service-pricing";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Gate = Database["public"]["Tables"]["service_gates"]["Row"];
type Audit = Database["public"]["Tables"]["service_gate_audit"]["Row"];

/** Super-admin: Free | Freemium | Paid per service. Save draft → Activate syncs service_gates. */
export function PaymentGatesAdmin() {
  const [gates, setGates] = useState<Gate[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);
  const refreshUi = () => tick((n) => n + 1);

  const load = async () => {
    setLoading(true);
    const [{ data: gs }, { data: au }] = await Promise.all([
      supabase.from("service_gates").select("*").order("service"),
      supabase.from("service_gate_audit").select("*").order("created_at", { ascending: false }).limit(15),
    ]);
    setGates((gs ?? []) as Gate[]);
    setAudit((au ?? []) as Audit[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const gateFor = (service: string) => gates.find((g) => g.service === service);

  const saveDraft = (service: string) => {
    const draft = getServiceDraft(service);
    saveServiceDraft(service, draft);
    toast.success(`Draft saved — ${draft.label}`);
    refreshUi();
  };

  const activate = async (service: string) => {
    setBusy(service);
    const row = activateServicePricing(service);
    const fields = toGateFields(row);
    const g = gateFor(service);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("service_gates")
      .update({
        enabled: fields.enabled,
        price: row.mode === "paid" ? row.priceNgn : 0,
        model: fields.model as Gate["model"],
        updated_by: auth.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("service", service);
    if (!error && g) {
      await supabase.from("service_gate_audit").insert({
        service,
        action: "activated",
        old_value: { enabled: g.enabled, price: g.price, model: g.model, mode: row.mode },
        new_value: { enabled: fields.enabled, price: row.mode === "paid" ? row.priceNgn : 0, model: fields.model, mode: row.mode },
        actor: auth.user?.id ?? null,
      });
    }
    setBusy(null);
    if (error) return toast.error("Activate failed", { description: error.message });
    toast.success(`${row.label}: ${row.mode.toUpperCase()} live`);
    refreshUi();
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const live = listActiveServicePricing();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/60 rounded-lg p-3">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          Per-service <b>Free</b> · <b>Freemium</b> · <b>Paid</b>. Default is Free (pricing hidden).
          <b> Save</b> stores draft; <b>Activate</b> applies to <code>service_gates</code> platform-wide.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {OWANBE_SERVICE_CATALOG.map((cat) => {
          const draft = getServiceDraft(cat.id);
          const g = gateFor(cat.id);
          const showPricing = isServicePricingVisible(draft);
          const activeRow = live.find((s) => s.id === cat.id);
          return (
            <Card key={cat.id} className={activeRow?.mode !== "free" ? "border-primary/40" : undefined}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{g?.label || cat.label}</p>
                  <Badge variant={draft.active === false ? "outline" : "default"}>
                    {draft.active === false ? "DRAFT" : (activeRow?.mode || "free").toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mode</p>
                  <Select
                    value={draft.mode}
                    onValueChange={(v) => {
                      saveServiceDraft(cat.id, { mode: v as ServicePricingMode, label: g?.label || cat.label });
                      refreshUi();
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="freemium">Freemium</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.mode === "freemium" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Guest allowance</p>
                    <Input
                      type="number"
                      min={0}
                      value={draft.guestAllowance}
                      onChange={(e) => {
                        saveServiceDraft(cat.id, { guestAllowance: +e.target.value });
                        refreshUi();
                      }}
                    />
                  </div>
                )}
                {showPricing && draft.mode === "paid" && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Price (₦)</p>
                    <Input
                      type="number"
                      min={0}
                      value={draft.priceNgn}
                      onChange={(e) => {
                        saveServiceDraft(cat.id, { priceNgn: +e.target.value });
                        refreshUi();
                      }}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy === cat.id} onClick={() => saveDraft(cat.id)}>
                    Save
                  </Button>
                  <Button size="sm" disabled={busy === cat.id} onClick={() => activate(cat.id)}>
                    {busy === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activate"}
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
              const nv = (a.new_value ?? {}) as { enabled?: boolean; price?: number; model?: string; mode?: string };
              return (
                <div key={a.id} className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{new Date(a.created_at).toLocaleString()}</Badge>
                  <span className="font-medium text-foreground">{a.service}</span>
                  <span>{a.action}</span>
                  {nv.mode && <span>({nv.mode})</span>}
                  {nv.price != null && nv.mode === "paid" && <span>→ ₦{Number(nv.price).toLocaleString()}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
