import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, ShieldOff, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";
import { parseCsv, downloadCsv } from "@/lib/csv";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RoleRow = { user_id: string; role: "user" | "admin" | "super_admin"; profile?: { full_name: string | null } | null };

export function UsersAdmin() {
  const { user } = useAuth();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetId, setTargetId] = useState("");
  const [targetRole, setTargetRole] = useState<"admin" | "super_admin">("admin");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role, profiles:profiles!inner(full_name)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data as Array<{ user_id: string; role: string; profiles: { display_name: string | null; email: string | null } | null }>).map((r) => ({ user_id: r.user_id, role: r.role, profile: r.profiles })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grant = async () => {
    if (!targetId.trim()) return toast.error("Paste a user UUID");
    setBusy(true);
    const { error } = await supabase.rpc("grant_role", { _target: targetId.trim(), _role: targetRole });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Granted ${targetRole}`); setTargetId(""); load();
  };

  const revoke = async (uid: string, role: "admin" | "super_admin") => {
    if (!confirm(`Revoke ${role}?`)) return;
    const { error } = await supabase.rpc("revoke_role", { _target: uid, _role: role });
    if (error) return toast.error(error.message);
    toast.success("Revoked"); load();
  };

  // ── Bulk CSV import ───────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRole, setBulkRole] = useState<"admin" | "super_admin">("admin");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{ ok: string[]; fail: { id: string; reason: string }[] } | null>(null);

  const downloadTemplate = () => {
    downloadCsv("admin-roles-template.csv", ["user_id", "role"], {
      user_id: "00000000-0000-0000-0000-000000000000",
      role: "admin",
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setReport(null);
    try {
      const rows = await parseCsv<{ user_id?: string; role?: string }>(file);
      if (!rows.length) { toast.error("CSV is empty"); setImporting(false); return; }

      const ok: string[] = [];
      const fail: { id: string; reason: string }[] = [];
      const seen = new Set<string>();

      for (const [i, row] of rows.entries()) {
        const id = (row.user_id ?? "").trim();
        const roleRaw = (row.role ?? bulkRole).trim().toLowerCase();
        const role = roleRaw === "super_admin" ? "super_admin" : "admin";
        const label = id || `row ${i + 2}`;
        if (!id) { fail.push({ id: label, reason: "missing user_id" }); continue; }
        if (!UUID_RE.test(id)) { fail.push({ id, reason: "invalid UUID" }); continue; }
        if (seen.has(`${id}:${role}`)) { fail.push({ id, reason: "duplicate in file" }); continue; }
        seen.add(`${id}:${role}`);
        const { error } = await supabase.rpc("grant_role", { _target: id, _role: role as import("@/integrations/supabase/types").Database["public"]["Enums"]["app_role"] });
        if (error) fail.push({ id, reason: error.message });
        else ok.push(`${id} → ${role}`);
      }

      setReport({ ok, fail });
      if (ok.length) toast.success(`Granted ${ok.length} role${ok.length === 1 ? "" : "s"}`);
      if (fail.length) toast.error(`${fail.length} row${fail.length === 1 ? "" : "s"} failed`);
      load();
    } catch (err) {
      toast.error(err.message ?? "Failed to parse CSV");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4 space-y-3">
        <h3 className="font-display text-lg">Grant a role</h3>
        <p className="text-sm text-muted-foreground">Paste the target user's UUID (find it in the role list below or backend Auth).</p>
        <div className="flex flex-col md:flex-row gap-2">
          <Input placeholder="User UUID" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="flex-1" />
          <Select value={targetRole} onValueChange={(v) => setTargetRole(v as typeof targetRole)}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="super_admin">Super admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={grant} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}Grant</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display text-lg">Bulk grant via CSV</h3>
            <p className="text-sm text-muted-foreground">
              Columns: <code className="text-xs">user_id</code> (required UUID), <code className="text-xs">role</code> (optional — falls back to default below).
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileDown className="w-4 h-4 mr-2" /> Template
          </Button>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as typeof bulkRole)}>
            <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Default: Admin</SelectItem>
              <SelectItem value="super_admin">Default: Super admin</SelectItem>
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={importing} className="flex-1 md:flex-none">
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {importing ? "Importing…" : "Upload CSV"}
          </Button>
        </div>

        {report && (
          <div className="grid md:grid-cols-2 gap-3 pt-2">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-sm font-medium text-emerald-700">Granted ({report.ok.length})</div>
              {report.ok.length > 0 && (
                <ul className="mt-2 space-y-1 max-h-40 overflow-auto text-xs font-mono text-emerald-900/80">
                  {report.ok.map((line, i) => <li key={i} className="truncate">{line}</li>)}
                </ul>
              )}
            </div>
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
              <div className="text-sm font-medium text-rose-700">Failed ({report.fail.length})</div>
              {report.fail.length > 0 && (
                <ul className="mt-2 space-y-1 max-h-40 overflow-auto text-xs font-mono text-rose-900/80">
                  {report.fail.map((f, i) => (
                    <li key={i} className="truncate">{f.id} — {f.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
      {loading ? (
        <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <Card key={`${r.user_id}-${r.role}`} className="p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{r.profile?.full_name ?? "Unnamed"}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{r.user_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.role === "super_admin" ? "default" : r.role === "admin" ? "secondary" : "outline"} className="capitalize">{r.role.replace("_"," ")}</Badge>
                {r.role !== "user" && r.user_id !== user?.id && (
                  <Button size="sm" variant="outline" onClick={() => revoke(r.user_id, r.role as import("@/integrations/supabase/types").Database["public"]["Enums"]["app_role"])}><ShieldOff className="w-4 h-4" /></Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
