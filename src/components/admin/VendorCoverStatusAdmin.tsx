import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, RotateCw, ImageIcon } from "lucide-react";
import { toast } from "sonner";

const MAX_ATTEMPTS = 3;

type Vendor = {
  id: string;
  name: string;
  category: string;
  city: string;
  cover_url: string | null;
  cover_status: string;
  cover_attempts: number;
  cover_last_error: string | null;
  cover_generated_at: string | null;
};

type DerivedStatus = "pending" | "generating" | "failed" | "done";

/** Map raw DB state into the 4 statuses the user asked for. */
function deriveStatus(v: Vendor, runningIds: Set<string>): DerivedStatus {
  if (runningIds.has(v.id)) return "generating";
  if (v.cover_status === "done") return "done";
  if (v.cover_status === "failed") return "failed";
  return "pending";
}

const statusVariant: Record<DerivedStatus, "default" | "secondary" | "destructive" | "outline"> = {
  done: "default",
  generating: "secondary",
  pending: "outline",
  failed: "destructive",
};

export function VendorCoverStatusAdmin() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DerivedStatus>("all");
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendors")
      .select("id,name,category,city,cover_url,cover_status,cover_attempts,cover_last_error,cover_generated_at")
      .order("cover_status", { ascending: true })
      .order("name", { ascending: true })
      .limit(1000);
    if (error) toast.error(error.message);
    else setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Poll while any rerun is in flight
  useEffect(() => {
    if (runningIds.size === 0) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [runningIds]);

  async function rerun(v: Vendor) {
    if (runningIds.has(v.id)) return;
    setRunningIds(prev => new Set(prev).add(v.id));
    try {
      // Reset so the edge function will pick this vendor (and clear terminal failures)
      const { error: resetErr } = await supabase
        .from("vendors")
        .update({ cover_status: "pending", cover_attempts: 0, cover_last_error: null })
        .eq("id", v.id);
      if (resetErr) throw resetErr;

      const { error } = await supabase.functions.invoke("generate-vendor-covers", {
        body: { batch_size: 1, vendor_ids: [v.id] },
      });
      if (error) throw error;
      toast.success(`Regenerated cover for ${v.name}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Re-run failed: ${msg}`);
    } finally {
      setRunningIds(prev => {
        const n = new Set(prev);
        n.delete(v.id);
        return n;
      });
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter(v => {
      const s = deriveStatus(v, runningIds);
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (!q) return true;
      return v.name.toLowerCase().includes(q)
        || v.category.toLowerCase().includes(q)
        || v.city.toLowerCase().includes(q);
    });
  }, [vendors, search, statusFilter, runningIds]);

  const counts = useMemo(() => {
    const c = { pending: 0, generating: 0, failed: 0, done: 0 };
    for (const v of vendors) c[deriveStatus(v, runningIds)]++;
    return c;
  }, [vendors, runningIds]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle>Cover status per vendor</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">Pending: {counts.pending}</Badge>
          <Badge variant="secondary">Generating: {counts.generating}</Badge>
          <Badge variant="destructive">Failed: {counts.failed}</Badge>
          <Badge>Done: {counts.done}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search by name, category, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="generating">Generating</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filtered.length} of {vendors.length}
          </span>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Cover</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Attempts</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    {loading ? "Loading…" : "No vendors match these filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => {
                  const s = deriveStatus(v, runningIds);
                  const isRunning = s === "generating";
                  const terminal = v.cover_status === "failed" && v.cover_attempts >= MAX_ATTEMPTS;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        {v.cover_url ? (
                          <img
                            src={v.cover_url}
                            alt={`${v.name} cover`}
                            loading="lazy"
                            className="h-10 w-14 object-cover rounded"
                          />
                        ) : (
                          <div className="h-10 w-14 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{v.name}</div>
                        <div className="text-xs text-muted-foreground">{v.city}</div>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{v.category}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[s]} className="capitalize">{s}</Badge>
                        {terminal && s === "failed" && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-destructive">terminal</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{v.cover_attempts}</TableCell>
                      <TableCell className="max-w-[260px] text-xs text-muted-foreground truncate" title={v.cover_last_error ?? ""}>
                        {v.cover_last_error ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isRunning}
                          onClick={() => rerun(v)}
                        >
                          {isRunning ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCw className="mr-2 h-3.5 w-3.5" />
                          )}
                          {isRunning ? "Generating…" : "Re-run"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
