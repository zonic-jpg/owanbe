import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  url: string;
  referrer: string | null;
  kind: string;
  user_agent: string | null;
  user_id: string | null;
  created_at: string;
};

export function NotFoundLogsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_404_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("Failed to load", { description: error.message });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const clearOlderThan = async (days: number) => {
    if (!confirm(`Delete 404 logs older than ${days} day(s)?`)) return;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const { error } = await supabase.from("client_404_logs").delete().lt("created_at", cutoff);
    if (error) return toast.error("Delete failed", { description: error.message });
    toast.success("Cleared");
    load();
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return r.url.toLowerCase().includes(s) || (r.referrer ?? "").toLowerCase().includes(s) || r.kind.includes(s);
  });

  // Quick aggregation: top URLs
  const topUrls = Object.entries(
    rows.reduce<Record<string, number>>((acc, r) => {
      const key = `${r.kind}  ${r.url}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Input placeholder="Search URL, referrer, or kind…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
        <Button variant="outline" size="sm" onClick={() => clearOlderThan(7)}><Trash2 className="w-4 h-4 mr-1" /> Clear &gt; 7 days</Button>
        <Button variant="outline" size="sm" onClick={() => clearOlderThan(0)}><Trash2 className="w-4 h-4 mr-1" /> Clear all</Button>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} of {rows.length}</span>
      </div>

      {topUrls.length > 0 && (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium mb-2">Top offenders</h3>
          <ul className="text-sm space-y-1">
            {topUrls.map(([key, count]) => (
              <li key={key} className="flex justify-between gap-4">
                <span className="truncate">{key}</span>
                <span className="text-muted-foreground tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Referrer</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell><span className="rounded bg-muted px-2 py-0.5 text-xs">{r.kind}</span></TableCell>
                  <TableCell className="font-mono text-xs break-all max-w-md">{r.url}</TableCell>
                  <TableCell className="font-mono text-xs break-all max-w-xs text-muted-foreground">{r.referrer ?? "—"}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">{r.user_id?.slice(0, 8) ?? "anon"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No 404s logged yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
