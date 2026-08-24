import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RotateCw, Download, ShieldCheck, ShieldX, Sparkles } from "lucide-react";
import { toast } from "sonner";

type AuditRow = {
  id: string;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  role: string;
  created_at: string;
};

const actionMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  grant:     { label: "Grant",     icon: ShieldCheck, cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
  revoke:    { label: "Revoke",    icon: ShieldX,     cls: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
  bootstrap: { label: "Bootstrap", icon: Sparkles,    cls: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
};

function shortId(id: string | null) {
  if (!id) return "—";
  return id.slice(0, 8);
}

export function AuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [action, setAction] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("role_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data ?? []) as AuditRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const a = actor.trim().toLowerCase();
    const t = target.trim().toLowerCase();
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      if (role !== "all" && r.role !== role) return false;
      if (a && !(r.actor_id ?? "").toLowerCase().includes(a)) return false;
      if (t && !r.target_user_id.toLowerCase().includes(t)) return false;
      if (s) {
        const blob = `${r.actor_id ?? ""} ${r.target_user_id} ${r.action} ${r.role}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [rows, actor, target, action, role, search]);

  const stats = useMemo(() => ({
    total: filtered.length,
    grants: filtered.filter((r) => r.action === "grant").length,
    revokes: filtered.filter((r) => r.action === "revoke").length,
  }), [filtered]);

  function reset() {
    setActor(""); setTarget(""); setAction("all"); setRole("all"); setSearch("");
  }

  function exportCsv() {
    if (!filtered.length) { toast.info("No rows to export"); return; }
    const header = ["timestamp", "action", "role", "actor_id", "target_user_id"];
    const lines = filtered.map((r) => [
      r.created_at, r.action, r.role, r.actor_id ?? "", r.target_user_id,
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `role-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Events" value={stats.total} />
        <StatCard label="Grants" value={stats.grants} tone="emerald" />
        <StatCard label="Revokes" value={stats.revokes} tone="rose" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 space-y-1.5">
              <Label htmlFor="audit-search" className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="audit-search"
                  className="pl-9"
                  placeholder="Search any field…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-actor" className="text-xs">Actor (UUID)</Label>
              <Input
                id="audit-actor"
                placeholder="e.g. 8f3a…"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-target" className="text-xs">Target (UUID)</Label>
              <Input
                id="audit-target"
                placeholder="e.g. 4b21…"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Action</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="grant">Grant</SelectItem>
                    <SelectItem value="revoke">Revoke</SelectItem>
                    <SelectItem value="bootstrap">Bootstrap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="super_admin">Super admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
            <Button variant="outline" size="sm" onClick={load}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Events
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({filtered.length} of {rows.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No audit events match your filters.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">When</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                    <TableHead className="w-[140px]">Role</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const meta = actionMeta[r.action] ?? { label: r.action, icon: Sparkles, cls: "" };
                    const Icon = meta.icon;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("en-NG", {
                            year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.cls}>
                            <Icon className="h-3 w-3 mr-1" /> {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {r.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => { navigator.clipboard.writeText(r.actor_id ?? ""); toast.success("Actor ID copied"); }}
                            className="font-mono text-xs hover:text-primary disabled:opacity-50"
                            disabled={!r.actor_id}
                            title={r.actor_id ?? ""}
                          >
                            {shortId(r.actor_id)}…
                          </button>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => { navigator.clipboard.writeText(r.target_user_id); toast.success("Target ID copied"); }}
                            className="font-mono text-xs hover:text-primary"
                            title={r.target_user_id}
                          >
                            {shortId(r.target_user_id)}…
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "rose" }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600" :
    tone === "rose" ? "text-rose-600" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
