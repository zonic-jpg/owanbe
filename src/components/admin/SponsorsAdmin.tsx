import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CsvImport } from "./CsvImport";
import { CATEGORY_GROUPS, ALL_CATEGORIES, prettyCategory } from "@/lib/vendor-categories";

type Row = { id: string; brand_name: string; category: string | null; logo_url: string | null; link: string | null; copy: string | null; is_active: boolean; };
const empty: Partial<Row> = { brand_name: "", category: "decor", logo_url: "", link: "", copy: "", is_active: true };

export function SponsorsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("sponsors").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setRows((data as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.brand_name) return toast.error("Brand name required");
    setSaving(true);
    const payload: Record<string, unknown> = { ...editing }; delete payload.created_at;
    const { error } = editing.id
      ? await supabase.from("sponsors").update(payload).eq("id", editing.id)
      : await supabase.from("sponsors").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this sponsor?")) return;
    const { error } = await supabase.from("sponsors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const importRows = async (csv: Record<string, string>[]) => {
    const allowed = new Set(ALL_CATEGORIES);
    const errors: string[] = [];
    const valid = csv.map((r, i) => {
      const rawCat = r.category ? String(r.category).trim().toLowerCase().replace(/\s+/g, "_") : null;
      if (rawCat && !allowed.has(rawCat)) {
        errors.push(`Row ${i + 1}: unknown category "${r.category}" — leaving blank.`);
      }
      return {
        brand_name: String(r.brand_name ?? "").trim(),
        category: rawCat && allowed.has(rawCat) ? rawCat : null,
        logo_url: r.logo_url ?? null,
        link: r.link ?? null,
        copy: r.copy ?? null,
        is_active: String(r.is_active ?? "true") !== "false",
      };
    }).filter((r) => r.brand_name);
    if (!valid.length) return { inserted: 0, failed: csv.length, errors: ["No valid rows.", ...errors] };
    const { error } = await supabase.from("sponsors").insert(valid as import("@/integrations/supabase/types").Database["public"]["Tables"]["sponsors"]["Insert"][]);
    await load();
    return { inserted: error ? 0 : valid.length, failed: error ? valid.length : csv.length - valid.length, errors: error ? [error.message, ...errors] : errors };
  };

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    if (r.category) acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});
  const filteredRows = filterCat === "all" ? rows : rows.filter((r) => r.category === filterCat);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Brand placements shown contextually inside event flows.</p>
        <div className="flex items-center gap-2 flex-wrap">
          <CsvImport
            templateName="sponsors-template.csv"
            headers={["brand_name","category","logo_url","link","copy","is_active"]}
            sampleRow={{ brand_name: "Hennessy", category: "drinks", logo_url: "https://…", link: "https://hennessy.com", copy: "Premium cognac for premium Owanbes.", is_active: "true" }}
            onRows={importRows}
          />
          <Button size="sm" onClick={() => { setEditing({ ...empty }); setOpen(true); }}><Plus className="w-4 h-4 mr-1" /> New sponsor</Button>
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Filter by category</Label>
            {filterCat !== "all" && (
              <Button size="sm" variant="ghost" onClick={() => setFilterCat("all")}>Clear</Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={filterCat === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterCat("all")}
            >
              All ({rows.length})
            </Badge>
            {CATEGORY_GROUPS.flatMap((g) => g.categories).map((c) => {
              const n = counts[c] ?? 0;
              if (!n) return null;
              return (
                <Badge
                  key={c}
                  variant={filterCat === c ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFilterCat(c)}
                >
                  {prettyCategory(c)} ({n})
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((s) => (
            <Card key={s.id} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded bg-muted overflow-hidden flex-shrink-0">
                  {s.logo_url && <img src={s.logo_url} alt={s.brand_name} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display truncate">{s.brand_name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.category && <Badge variant="outline" className="text-xs">{prettyCategory(s.category)}</Badge>}
                    {!s.is_active && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                  </div>
                </div>
              </div>
              {s.copy && <p className="text-sm text-muted-foreground line-clamp-2">{s.copy}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="w-4 h-4 mr-1" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </Card>
          ))}
          {!rows.length && <p className="text-center text-muted-foreground py-8 col-span-full">No sponsors yet.</p>}
          {rows.length > 0 && !filteredRows.length && (
            <p className="text-center text-muted-foreground py-8 col-span-full">No sponsors in this category yet.</p>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit sponsor" : "New sponsor"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Brand name *</Label><Input value={editing.brand_name ?? ""} onChange={(e) => setEditing({ ...editing, brand_name: e.target.value })} /></div>
              <div>
                <Label>Category</Label>
                <Select value={editing.category ?? ""} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {CATEGORY_GROUPS.map((g) => (
                      <SelectGroup key={g.label}>
                        <SelectLabel>{g.label}</SelectLabel>
                        {g.categories.map((c) => (
                          <SelectItem key={c} value={c}>{prettyCategory(c)}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3"><Label>Active</Label><Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /></div>
              <div className="sm:col-span-2"><Label>Logo URL</Label><Input value={editing.logo_url ?? ""} onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Click-through link</Label><Input value={editing.link ?? ""} onChange={(e) => setEditing({ ...editing, link: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Tagline / copy</Label><Textarea rows={2} value={editing.copy ?? ""} onChange={(e) => setEditing({ ...editing, copy: e.target.value })} /></div>
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
