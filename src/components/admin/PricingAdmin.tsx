import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CsvImport } from "./CsvImport";

const SERVICES = ["decor","catering","photography","dj","mc","makeup","aso_ebi","cake","venue","drinks","security","logistics","souvenirs"] as const;
const TIERS = ["gold","platinum","diamond"] as const;
const CITIES = ["Lagos","Abuja","Port Harcourt","Ibadan","Benin City","Kano","Enugu"];

type Row = {
  id: string; service: string; city: string; tier_level: string;
  base_price_per_guest: number; base_flat_price: number; notes: string | null; is_active: boolean;
};

const empty: Partial<Row> = { service: "decor", city: "Lagos", tier_level: "gold", base_price_per_guest: 0, base_flat_price: 0, notes: "", is_active: true };
const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

export function PricingAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("service_price_config").select("*").order("service").order("city").order("tier_level");
    if (error) toast.error(error.message); else setRows((data as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.service || !editing?.city || !editing?.tier_level) return toast.error("Service, city and tier are required");
    setSaving(true);
    const payload: Record<string, unknown> = { ...editing, base_price_per_guest: Number(editing.base_price_per_guest ?? 0), base_flat_price: Number(editing.base_flat_price ?? 0) };
    delete payload.updated_at;
    const { error } = editing.id
      ? await supabase.from("service_price_config").update(payload).eq("id", editing.id)
      : await supabase.from("service_price_config").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this pricing rule?")) return;
    const { error } = await supabase.from("service_price_config").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const importRows = async (csv: Record<string, string>[]) => {
    const valid = csv.map((r) => ({
      service: String(r.service ?? "").trim(),
      city: String(r.city ?? "").trim(),
      tier_level: String(r.tier_level ?? "").trim(),
      base_price_per_guest: Number(r.base_price_per_guest ?? 0),
      base_flat_price: Number(r.base_flat_price ?? 0),
      notes: r.notes ?? null,
      is_active: String(r.is_active ?? "true") !== "false",
    })).filter((r) => SERVICES.includes(r.service as (typeof SERVICES)[number]) && r.city && TIERS.includes(r.tier_level as (typeof TIERS)[number]));
    if (!valid.length) return { inserted: 0, failed: csv.length, errors: ["No valid rows."] };
    // upsert via on-conflict unique key (service, city, tier_level)
    const { error } = await supabase.from("service_price_config").upsert(valid as import("@/integrations/supabase/types").Database["public"]["Tables"]["service_price_config"]["Insert"][], { onConflict: "service,city,tier_level" });
    await load();
    return { inserted: error ? 0 : valid.length, failed: error ? valid.length : csv.length - valid.length, errors: error ? [error.message] : [] };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Per-service, per-city, per-tier pricing used by the AI tier generator.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <CsvImport
            templateName="pricing-template.csv"
            headers={["service","city","tier_level","base_price_per_guest","base_flat_price","notes","is_active"]}
            sampleRow={{ service: "catering", city: "Lagos", tier_level: "gold", base_price_per_guest: "8500", base_flat_price: "0", notes: "Buffet style", is_active: "true" }}
            onRows={importRows}
          />
          <Button size="sm" onClick={() => { setEditing({ ...empty }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> New rule</Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-3 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                <span className="capitalize font-medium">{r.service.replace("_"," ")}</span>
                <span>{r.city}</span>
                <span className="capitalize">{r.tier_level}</span>
                <span>{fmt(r.base_price_per_guest)}/guest</span>
                <span>{fmt(r.base_flat_price)} flat</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
          {!rows.length && <p className="text-center text-muted-foreground py-8">No pricing rules yet.</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit pricing rule" : "New pricing rule"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Service *</Label>
                <Select value={editing.service} onValueChange={(v) => setEditing({ ...editing, service: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_"," ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>City *</Label>
                <Select value={editing.city} onValueChange={(v) => setEditing({ ...editing, city: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tier *</Label>
                <Select value={editing.tier_level} onValueChange={(v) => setEditing({ ...editing, tier_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIERS.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3"><Label>Active</Label><Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /></div>
              <div><Label>Per-guest (₦)</Label><Input type="number" min={0} value={editing.base_price_per_guest ?? 0} onChange={(e) => setEditing({ ...editing, base_price_per_guest: Number(e.target.value) })} /></div>
              <div><Label>Flat price (₦)</Label><Input type="number" min={0} value={editing.base_flat_price ?? 0} onChange={(e) => setEditing({ ...editing, base_flat_price: Number(e.target.value) })} /></div>
              <div className="sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
