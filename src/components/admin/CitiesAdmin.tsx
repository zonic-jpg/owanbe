import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { publicError } from "@/lib/publicMessage";
import { CsvImport } from "@/components/admin/CsvImport";

type City = {
  id: string;
  name: string;
  state: string | null;
  population: number;
  social_tags: string[];
  notes: string | null;
  rank: number | null;
  is_active: boolean;
};

const empty = {
  name: "",
  state: "",
  population: 0,
  social_tags: "",
  notes: "",
  rank: "" as number | "",
  is_active: true,
};

export function CitiesAdmin() {
  const [rows, setRows] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState(empty);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("rank", { ascending: true, nullsFirst: false })
      .order("population", { ascending: false })
      .limit(1000);
    if (error) toast.error("Couldn't load cities", { description: publicError(error) });
    setRows((data ?? []) as City[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<City>) => {
    setBusy(id);
    const { error } = await supabase.from("cities").update(patch as import("@/integrations/supabase/types").Database["public"]["Tables"]["cities"]["Update"]).eq("id", id);
    setBusy(null);
    if (error) return toast.error("Couldn't save that change", { description: publicError(error) });
    toast.success("Saved");
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this city?")) return;
    const { error } = await supabase.from("cities").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete that city", { description: publicError(error) });
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const add = async () => {
    if (!draft.name.trim()) return toast.error("Name required");
    const payload = {
      name: draft.name.trim(),
      state: draft.state.trim() || null,
      population: Number(draft.population) || 0,
      social_tags: draft.social_tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: draft.notes.trim() || null,
      rank: draft.rank === "" ? null : Number(draft.rank),
      is_active: draft.is_active,
    };
    const { error } = await supabase.from("cities").insert(payload as import("@/integrations/supabase/types").Database["public"]["Tables"]["cities"]["Insert"]);
    if (error) return toast.error("Couldn't add that city", { description: publicError(error) });
    toast.success("City added");
    setDraft(empty);
    load();
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r.name.toLowerCase().includes(s) ||
      (r.state ?? "").toLowerCase().includes(s) ||
      r.social_tags.some((t) => t.toLowerCase().includes(s))
    );
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="font-medium">Add a city</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label>Name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <Label>State</Label>
            <Input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} />
          </div>
          <div>
            <Label>Population</Label>
            <Input
              type="number"
              value={draft.population}
              onChange={(e) => setDraft({ ...draft, population: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Rank</Label>
            <Input
              type="number"
              value={draft.rank}
              onChange={(e) => setDraft({ ...draft, rank: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end">
            <Button onClick={add} className="w-full"><Plus className="w-4 h-4 mr-1" />Add</Button>
          </div>
          <div className="md:col-span-3">
            <Label>Social tags (comma-separated)</Label>
            <Input
              value={draft.social_tags}
              onChange={(e) => setDraft({ ...draft, social_tags: e.target.value })}
              placeholder="weddings, owambe, carnival"
            />
          </div>
          <div className="md:col-span-3">
            <Label>Notes</Label>
            <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-medium">Bulk import / update via CSV</h3>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Columns: <code>name, state, population, social_tags, notes, rank, is_active</code>.
              Existing rows (matched by name + state) are updated; new ones are inserted.
              Separate social tags with <code>;</code> or <code>|</code>.
            </p>
          </div>
          <CsvImport
            templateName="cities-template.csv"
            headers={["name", "state", "population", "social_tags", "notes", "rank", "is_active"]}
            sampleRow={{
              name: "Lagos",
              state: "Lagos",
              population: "15900000",
              social_tags: "owambe; afrobeats; detty december",
              notes: "Capital of owambe",
              rank: "1",
              is_active: "true",
            }}
            onRows={async (rows: Record<string, string>[]) => {
              const errors: string[] = [];
              const payload = rows
                .map((r, i) => {
                  const name = String(r.name ?? "").trim();
                  if (!name) { errors.push(`Row ${i + 2}: name required`); return null; }
                  const tagsRaw = String(r.social_tags ?? "");
                  const tags = tagsRaw.split(/[;|]/).map((t) => t.trim()).filter(Boolean);
                  const isActive = String(r.is_active ?? "true").toLowerCase();
                  return {
                    name,
                    state: String(r.state ?? "").trim() || "",
                    population: Number(String(r.population ?? "0").replace(/[^\d.-]/g, "")) || 0,
                    social_tags: tags,
                    notes: String(r.notes ?? "").trim() || null,
                    rank: r.rank === undefined || r.rank === "" ? null : Number(r.rank),
                    is_active: !["false", "0", "no", "n"].includes(isActive),
                  };
                })
                .filter(Boolean) as import("@/integrations/supabase/types").Database["public"]["Tables"]["cities"]["Insert"][];

              let inserted = 0;
              const chunkSize = 200;
              for (let i = 0; i < payload.length; i += chunkSize) {
                const chunk = payload.slice(i, i + chunkSize);
                const { error, data } = await supabase
                  .from("cities")
                  .upsert(chunk, { onConflict: "name,state" })
                  .select("id");
                if (error) errors.push(error.message);
                else inserted += data?.length ?? 0;
              }
              await load();
              return { inserted, failed: rows.length - inserted, errors };
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search cities, states, or tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-muted-foreground whitespace-nowrap">{filtered.length} of {rows.length}</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Population</TableHead>
                <TableHead>Social tags</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <CityRow key={r.id} row={r} busy={busy === r.id} onSave={(patch) => update(r.id, patch)} onDelete={() => remove(r.id)} />
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No cities yet. Add one above.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CityRow({ row, busy, onSave, onDelete }: {
  row: City;
  busy: boolean;
  onSave: (patch: Partial<City>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [state, setState] = useState(row.state ?? "");
  const [population, setPopulation] = useState<number>(row.population);
  const [tags, setTags] = useState(row.social_tags.join(", "));
  const [notes, setNotes] = useState(row.notes ?? "");
  const [rank, setRank] = useState<string>(row.rank?.toString() ?? "");
  const [active, setActive] = useState(row.is_active);

  const dirty =
    name !== row.name ||
    state !== (row.state ?? "") ||
    population !== row.population ||
    tags !== row.social_tags.join(", ") ||
    notes !== (row.notes ?? "") ||
    rank !== (row.rank?.toString() ?? "") ||
    active !== row.is_active;

  return (
    <TableRow>
      <TableCell>
        <Input className="h-8 w-16" value={rank} onChange={(e) => setRank(e.target.value)} />
      </TableCell>
      <TableCell><Input className="h-8" value={name} onChange={(e) => setName(e.target.value)} /></TableCell>
      <TableCell><Input className="h-8 w-28" value={state} onChange={(e) => setState(e.target.value)} /></TableCell>
      <TableCell className="text-right">
        <Input className="h-8 w-28 ml-auto text-right" type="number" value={population} onChange={(e) => setPopulation(Number(e.target.value))} />
      </TableCell>
      <TableCell><Textarea className="min-h-[36px]" value={tags} onChange={(e) => setTags(e.target.value)} /></TableCell>
      <TableCell><Textarea className="min-h-[36px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></TableCell>
      <TableCell>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={!dirty || busy} onClick={() => onSave({
            name, state: state || null, population,
            social_tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            notes: notes || null,
            rank: rank === "" ? null : Number(rank),
            is_active: active,
          })}>
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
