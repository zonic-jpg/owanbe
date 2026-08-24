import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

type Perm = "view_financials" | "grant_waivers";
type Row = { id: string; user_id: string; perm: Perm; created_at: string; profile?: { full_name: string | null } | null };

export function AdminPermsAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [perm, setPerm] = useState<Perm>("view_financials");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_permissions")
      .select("id, user_id, perm, created_at, profiles:profiles!inner(full_name)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data as Array<Record<string, unknown> & { profiles: unknown }>).map((r) => ({ ...r, profile: r.profiles })) as typeof rows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grant = async () => {
    if (!target.trim()) return toast.error("Paste a user UUID");
    setBusy(true);
    const { error } = await supabase.rpc("grant_admin_permission", { _target: target.trim(), _perm: perm });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Granted ${perm}`); setTarget(""); load();
  };

  const revoke = async (uid: string, p: Perm) => {
    if (!confirm(`Revoke ${p}?`)) return;
    const { error } = await supabase.rpc("revoke_admin_permission", { _target: uid, _perm: p });
    if (error) return toast.error(error.message);
    toast.success("Revoked"); load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Grant admin permission</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Super admin only. Lets specific admins view financials or grant fee waivers without making them super admins.
          </p>
          <div className="flex flex-col md:flex-row gap-2">
            <Input placeholder="User UUID" value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1" />
            <Select value={perm} onValueChange={(v: Perm) => setPerm(v)}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="view_financials">view_financials</SelectItem>
                <SelectItem value="grant_waivers">grant_waivers</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={grant} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Grant
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Granted permissions ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-24" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin permissions granted yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.profile?.full_name ?? "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{r.user_id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{r.perm}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => revoke(r.user_id, r.perm)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
