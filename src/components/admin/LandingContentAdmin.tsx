import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Pin } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  key: string;
  kind: "text" | "image" | "html" | "json";
  value: string;
  origin: "mock" | "live";
  retain: boolean;
  position: number;
};

export function LandingContentAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Record<string, Partial<Row>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("landing_content")
      .select("id, key, kind, value, origin, retain, position")
      .order("position");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setDirty({});
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = (id: string, p: Partial<Row>) => setDirty((d) => ({ ...d, [id]: { ...d[id], ...p } }));

  const save = async (row: Row) => {
    const changes = dirty[row.id];
    if (!changes) return;
    setSaving(row.id);
    const { error } = await supabase.from("landing_content").update(changes).eq("id", row.id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success(`Saved ${row.key}`);
    load();
  };

  const toggleRetain = async (row: Row) => {
    const { error } = await supabase.from("landing_content").update({ retain: !row.retain }).eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading…</div>;

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <h3 className="font-display text-lg">Landing page content</h3>
        <p className="text-sm text-muted-foreground">
          Edit every text and image block on the public landing page. Pin a row with the retain toggle to keep it visible after switching to live mode.
        </p>
      </Card>

      <div className="space-y-2">
        {rows.map((row) => {
          const current = { ...row, ...dirty[row.id] };
          const hasChanges = !!dirty[row.id];
          return (
            <Card key={row.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.origin === "live" ? "default" : "secondary"}>{row.origin}</Badge>
                    <Badge variant="outline">{row.kind}</Badge>
                    {row.retain && <Badge className="bg-amber-500 text-white">retained</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <Pin className="w-3.5 h-3.5" /> Retain
                    <Switch checked={row.retain} onCheckedChange={() => toggleRetain(row)} />
                  </label>
                  <Button size="sm" disabled={!hasChanges || saving === row.id} onClick={() => save(row)} className="gap-2">
                    {saving === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </Button>
                </div>
              </div>

              {row.kind === "image" ? (
                <div className="grid md:grid-cols-[1fr_140px] gap-3">
                  <Input
                    value={current.value}
                    onChange={(e) => patch(row.id, { value: e.target.value })}
                    placeholder="https://… or /src/assets/…"
                  />
                  {current.value && (
                    <img src={current.value.startsWith("/src/assets/") ? current.value : current.value} alt="" className="h-24 w-full object-cover rounded-md border" onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")} />
                  )}
                </div>
              ) : current.value.length > 80 || current.value.includes("\n") ? (
                <Textarea
                  rows={3}
                  value={current.value}
                  onChange={(e) => patch(row.id, { value: e.target.value })}
                />
              ) : (
                <Input
                  value={current.value}
                  onChange={(e) => patch(row.id, { value: e.target.value })}
                />
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
