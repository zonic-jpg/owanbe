import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, Plus, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";

type Waiver = {
  id: string; match_type: "name" | "email" | "code"; match_value: string;
  code: string | null; notes: string | null; expires_at: string | null;
  is_active: boolean; used_by_brand: string | null; used_at: string | null; created_at: string;
};

function genCode(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WVR-${part()}-${part()}`;
}

export function WaiversAdmin() {
  const { canGrantWaivers } = useAuth();
  const [list, setList] = useState<Waiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"name" | "email" | "code">("name");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState(genCode());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("brand_waivers").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setList((data ?? []) as Waiver[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (type !== "code" && !value.trim()) return toast.error("Enter a brand name or email");
    setBusy(true);
    const payload: Record<string, unknown> = {
      match_type: type,
      match_value: type === "code" ? code : value.trim(),
      code: type === "code" ? code : null,
      notes: notes.trim() || null,
    };
    const { error } = await supabase.from("brand_waivers").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Waiver created");
    setValue(""); setNotes(""); setCode(genCode());
    load();
  };

  const deactivate = async (id: string) => {
    const { error } = await supabase.from("brand_waivers").update({ is_active: false }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deactivated"); load();
  };

  if (!canGrantWaivers) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">You don't have permission to manage waivers.</p>
          <p className="text-sm text-muted-foreground">Ask a super admin to grant you the <code>grant_waivers</code> permission.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> Grant a fee waiver</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Match by</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Brand name</SelectItem>
                  <SelectItem value="email">Brand email</SelectItem>
                  <SelectItem value="code">One-time code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>{type === "code" ? "Generated code" : type === "name" ? "Brand name" : "Brand email"}</Label>
              {type === "code" ? (
                <div className="flex gap-2">
                  <Input value={code} readOnly className="font-mono" />
                  <Button type="button" variant="outline" onClick={() => setCode(genCode())}>Regenerate</Button>
                </div>
              ) : (
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "name" ? "Exact brand name" : "brand@example.com"} maxLength={255} />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal note" maxLength={500} />
          </div>
          <Button onClick={create} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create waiver
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active & past waivers ({list.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32" /> : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No waivers yet.</p>
          ) : (
            <div className="space-y-2">
              {list.map((w) => (
                <div key={w.id} className="flex items-center justify-between gap-3 border rounded-md p-3 text-sm flex-wrap">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">{w.match_type}</Badge>
                      <span className="font-mono truncate">{w.match_value}</span>
                      {!w.is_active && <Badge variant="secondary">Inactive</Badge>}
                      {w.used_by_brand && <Badge>Used</Badge>}
                    </div>
                    {w.notes && <div className="text-xs text-muted-foreground">{w.notes}</div>}
                    <div className="text-xs text-muted-foreground">Created {new Date(w.created_at).toLocaleDateString()}</div>
                  </div>
                  {w.is_active && (
                    <Button size="sm" variant="ghost" onClick={() => deactivate(w.id)}>
                      <X className="h-4 w-4 mr-1" /> Deactivate
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
