import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CsvImport } from "./CsvImport";

const CATEGORIES = ["decor","catering","photography","dj","mc","makeup","aso_ebi","cake","venue","drinks","security","logistics","souvenirs","planner","florist","videographer","hair_stylist","bridal_wear","gele","lighting_av","transport","stationery","rentals","bar_service","groom_attire","jewellery","small_chops","dessert_table","photo_booth","fireworks","kids_entertainment","alaga","proposal_planner"] as const;
const PRICE_BANDS = ["affordable","mid","premium","luxury"] as const;
const CITIES = ["Lagos","Abuja","Port Harcourt","Ibadan","Benin City","Kano","Enugu"];

type Vendor = {
  id: string; name: string; category: string; city: string; price_band: string;
  bio: string | null; whatsapp: string | null; contact_email: string | null;
  cover_url: string | null; rating: number; is_approved: boolean; is_sponsored: boolean;
};

const empty: Partial<Vendor> = {
  name: "", category: "decor", city: "Lagos", price_band: "mid",
  bio: "", whatsapp: "", contact_email: "", cover_url: "",
  rating: 4.5, is_approved: true, is_sponsored: false,
};

export function VendorsAdmin() {
  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Vendor> | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("vendors").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setRows((data as Vendor[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.category || !editing?.city) {
      toast.error("Name, category and city are required"); return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = { ...editing };
    delete payload.created_at; delete payload.updated_at;
    const { error } = editing.id
      ? await supabase.from("vendors").update(payload).eq("id", editing.id)
      : await supabase.from("vendors").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing.id ? "Vendor updated" : "Vendor created");
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this vendor?")) return;
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const importRows = async (csv: Record<string, string>[]) => {
    const valid = csv
      .map((r) => ({
        name: String(r.name ?? "").trim(),
        category: String(r.category ?? "").trim(),
        city: String(r.city ?? "").trim(),
        price_band: String(r.price_band ?? "mid").trim(),
        bio: r.bio ?? null,
        whatsapp: r.whatsapp ?? null,
        contact_email: r.contact_email ?? null,
        cover_url: r.cover_url ?? null,
        rating: r.rating ? Number(r.rating) : 4.5,
        is_approved: String(r.is_approved ?? "true") !== "false",
        is_sponsored: String(r.is_sponsored ?? "false") === "true",
      }))
      .filter((r) => r.name && CATEGORIES.includes(r.category as (typeof CATEGORIES)[number]) && r.city);
    if (!valid.length) return { inserted: 0, failed: csv.length, errors: ["No valid rows. Check category/city."] };
    const { error, count } = await supabase.from("vendors").insert(valid as import("@/integrations/supabase/types").Database["public"]["Tables"]["vendors"]["Insert"][], { count: "exact" });
    await load();
    return { inserted: error ? 0 : (count ?? valid.length), failed: error ? valid.length : (csv.length - valid.length), errors: error ? [error.message] : [] };
  };

  const filtered = rows.filter((r) => {
    const q = filter.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <Input placeholder="Search by name, city or category…" value={filter} onChange={(e) => setFilter(e.target.value)} className="md:max-w-sm" />
        <div className="flex items-center gap-2 flex-wrap">
          <CsvImport
            templateName="vendors-template.csv"
            headers={["name","category","city","price_band","bio","whatsapp","contact_email","cover_url","rating","is_approved","is_sponsored"]}
            sampleRow={{ name: "Glam by Joyce", category: "makeup", city: "Abuja", price_band: "mid", bio: "Bridal MUA", whatsapp: "+2348012345678", contact_email: "joyce@glam.ng", cover_url: "https://…", rating: "4.7", is_approved: "true", is_sponsored: "false" }}
            onRows={importRows}
          />
          <Button size="sm" onClick={() => { setEditing({ ...empty }); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" /> New vendor
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((v) => (
            <Card key={v.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-full md:w-24 h-24 rounded-md bg-muted overflow-hidden flex-shrink-0">
                {v.cover_url && <img src={v.cover_url} alt={v.name} className="w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-lg truncate">{v.name}</h3>
                  {v.is_sponsored && <Badge className="bg-gradient-gold text-primary-foreground">Sponsored</Badge>}
                  {!v.is_approved && <Badge variant="outline">Hidden</Badge>}
                </div>
                <p className="text-sm text-muted-foreground capitalize">{v.category.replace("_"," ")} • {v.city} • {v.price_band}</p>
                <p className="text-sm flex items-center gap-1 mt-1"><Star className="w-3.5 h-3.5 fill-primary text-primary" /> {v.rating}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditing(v); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => remove(v.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
          {!filtered.length && <p className="text-center text-muted-foreground py-8">No vendors match.</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Name *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div>
                <Label>Category *</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace("_"," ")}</SelectItem>)}</SelectContent>
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
                <Label>Price band</Label>
                <Select value={editing.price_band} onValueChange={(v) => setEditing({ ...editing, price_band: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRICE_BANDS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rating</Label>
                <Input type="number" min={0} max={5} step={0.1} value={editing.rating ?? 4.5} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })} />
              </div>
              <div><Label>WhatsApp</Label><Input value={editing.whatsapp ?? ""} onChange={(e) => setEditing({ ...editing, whatsapp: e.target.value })} /></div>
              <div><Label>Contact email</Label><Input type="email" value={editing.contact_email ?? ""} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Cover image URL</Label><Input value={editing.cover_url ?? ""} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Bio</Label><Textarea rows={3} value={editing.bio ?? ""} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-md border p-3"><Label>Approved (visible)</Label><Switch checked={!!editing.is_approved} onCheckedChange={(v) => setEditing({ ...editing, is_approved: v })} /></div>
              <div className="flex items-center justify-between rounded-md border p-3"><Label>Sponsored</Label><Switch checked={!!editing.is_sponsored} onCheckedChange={(v) => setEditing({ ...editing, is_sponsored: v })} /></div>
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
