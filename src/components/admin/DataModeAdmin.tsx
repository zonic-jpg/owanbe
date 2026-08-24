import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Eye, CheckCircle2, Sparkles, Trash2, AlertTriangle } from "lucide-react";

type Settings = { preview_mode: "mock" | "live"; published_mode: "mock" | "live"; demo_login_enabled: boolean; updated_at: string };
type Counts = { table: string; mock: number; live: number; retained: number };

const TABLES = [
  "catalog_products",
  "vendors",
  "vendor_portfolio",
  "sponsors",
  "cities",
  "service_price_config",
  "landing_content",
] as const;

export function DataModeAdmin() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [counts, setCounts] = useState<Counts[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("app_settings").select("preview_mode, published_mode, demo_login_enabled, updated_at").maybeSingle();
    setSettings(s as Settings);
    const rows: Counts[] = [];
    for (const t of TABLES) {
      const { data } = await (supabase as import("@supabase/supabase-js").SupabaseClient).from(t).select("origin, retain");
      const list = ((data ?? []) as unknown) as { origin: string; retain: boolean }[];
      rows.push({
        table: t,
        mock: list.filter((r) => r.origin === "mock").length,
        live: list.filter((r) => r.origin === "live").length,
        retained: list.filter((r) => r.retain).length,
      });
    }
    setCounts(rows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const setPreview = async (mode: "mock" | "live") => {
    setBusy("preview");
    const { error } = await supabase.rpc("set_preview_mode", { _mode: mode });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Preview now showing ${mode} data`);
    load();
  };

  const approve = async () => {
    if (!confirm(`Publish "${settings?.preview_mode}" data to all public visitors?`)) return;
    setBusy("approve");
    const { error } = await supabase.rpc("approve_preview");
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Public site now shows ${settings?.preview_mode} data`);
    load();
  };

  const promote = async () => {
    setBusy("promote");
    const { data, error } = await supabase.rpc("promote_retained_to_live");
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Promoted ${data} retained rows to live`);
    load();
  };

  const purge = async () => {
    if (!confirm("Permanently delete all mock rows that are NOT retained? This cannot be undone.")) return;
    setBusy("purge");
    const { data, error } = await supabase.rpc("purge_mock_data");
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Purged ${data} mock rows`);
    load();
  };

  const setDemo = async (v: boolean) => {
    setBusy("demo");
    const { error } = await supabase.rpc("set_demo_login_enabled", { _enabled: v });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(v ? "Demo sign-in enabled" : "Demo sign-in disabled — button hidden from sign-in page");
    load();
  };

  if (loading || !settings) {
    return <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading…</div>;
  }

  const dirty = settings.preview_mode !== settings.published_mode;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <h3 className="font-display text-lg flex items-center gap-2"><Eye className="w-5 h-5 text-primary" /> Data mode</h3>
            <p className="text-sm text-muted-foreground max-w-xl">
              Flip the toggle to preview live-only data before going to production. Visitors keep seeing the currently approved mode until you click <strong>Approve & publish</strong>. Pin individual rows with <strong>Retain</strong> to carry them across.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={settings.published_mode === "live" ? "default" : "secondary"}>Public sees: {settings.published_mode}</Badge>
            <Badge variant="outline">Preview: {settings.preview_mode}</Badge>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
          <div className="space-y-1">
            <div className="font-medium">Admin preview mode</div>
            <div className="text-xs text-muted-foreground">Mock = show everything · Live = show only live + retained rows</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={settings.preview_mode === "mock" ? "font-semibold" : "text-muted-foreground"}>Mock</span>
            <Switch
              checked={settings.preview_mode === "live"}
              disabled={busy === "preview"}
              onCheckedChange={(v) => setPreview(v ? "live" : "mock")}
            />
            <span className={settings.preview_mode === "live" ? "font-semibold" : "text-muted-foreground"}>Live</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={approve} disabled={!dirty || busy === "approve"} className="gap-2">
            {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve & publish preview
          </Button>
          <Button variant="outline" onClick={promote} disabled={busy === "promote"} className="gap-2">
            {busy === "promote" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Promote retained → live
          </Button>
          <Button variant="destructive" onClick={purge} disabled={busy === "purge"} className="gap-2">
            {busy === "purge" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Purge unretained mock data
          </Button>
        </div>

        {dirty && (
          <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>Preview differs from published. Approve to push <strong>{settings.preview_mode}</strong> live to all visitors.</span>
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 max-w-xl">
            <h3 className="font-display text-lg">Tester sign-in</h3>
            <p className="text-sm text-muted-foreground">
              The sign-in page can show one-tap <strong>User / Brand / Admin</strong> tester logins.
              They are hidden automatically in the production build, and this switch is an extra
              server-side guard. Leave it off for production.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={settings.demo_login_enabled ? "text-muted-foreground" : "font-semibold"}>Off</span>
            <Switch
              checked={settings.demo_login_enabled}
              disabled={busy === "demo"}
              onCheckedChange={setDemo}
            />
            <span className={settings.demo_login_enabled ? "font-semibold" : "text-muted-foreground"}>On</span>
          </div>
        </div>
      </Card>


      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3 font-medium">Table</th>
              <th className="p-3 font-medium text-right">Mock</th>
              <th className="p-3 font-medium text-right">Live</th>
              <th className="p-3 font-medium text-right">Retained</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((r) => (
              <tr key={r.table} className="border-t">
                <td className="p-3 font-mono text-xs">{r.table}</td>
                <td className="p-3 text-right"><Badge variant="secondary">{r.mock}</Badge></td>
                <td className="p-3 text-right"><Badge>{r.live}</Badge></td>
                <td className="p-3 text-right"><Badge variant="outline">{r.retained}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
