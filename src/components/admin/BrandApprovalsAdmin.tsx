import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

type Brand = {
  id: string; name: string; contact_email: string; contact_phone: string | null;
  website: string | null; bio: string | null;
  status: "draft" | "awaiting_payment" | "awaiting_approval" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null; submitted_at: string | null; created_at: string;
};

export function BrandApprovalsAdmin() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("brands").select("*").order("submitted_at", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    else setBrands((data ?? []) as Brand[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("approve_brand", { _brand: id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Brand approved"); load();
  };
  const reject = async (id: string) => {
    const r = (reason[id] ?? "").trim();
    if (!r) return toast.error("Provide a rejection reason");
    setBusy(id);
    const { error } = await supabase.rpc("reject_brand", { _brand: id, _reason: r });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Brand rejected"); load();
  };

  const buckets = {
    pending: brands.filter((b) => b.status === "awaiting_approval"),
    approved: brands.filter((b) => b.status === "approved"),
    rejected: brands.filter((b) => b.status === "rejected"),
    other: brands.filter((b) => !["awaiting_approval", "approved", "rejected"].includes(b.status)),
  };

  const renderList = (list: Brand[]) => {
    if (loading) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
    if (list.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">Nothing here.</p>;
    return (
      <div className="space-y-3">
        {list.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                  <div>
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.contact_email}{b.contact_phone ? ` · ${b.contact_phone}` : ""}</div>
                    {b.website && <a href={b.website} target="_blank" rel="noreferrer" className="text-xs text-primary underline">{b.website}</a>}
                  </div>
                </div>
                <Badge variant={b.status === "approved" ? "default" : b.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                  {b.status.replace("_", " ")}
                </Badge>
              </div>
              {b.bio && <p className="text-sm text-muted-foreground line-clamp-3">{b.bio}</p>}
              {b.rejection_reason && <div className="text-xs text-destructive"><strong>Rejection:</strong> {b.rejection_reason}</div>}
              {b.status === "awaiting_approval" && (
                <div className="space-y-2 pt-1">
                  <Textarea
                    placeholder="Rejection reason (only required if rejecting)"
                    value={reason[b.id] ?? ""}
                    onChange={(e) => setReason({ ...reason, [b.id]: e.target.value })}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(b.id)} disabled={busy === b.id}>
                      {busy === b.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => reject(b.id)} disabled={busy === b.id}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader><CardTitle>Brand approvals</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending ({buckets.pending.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({buckets.approved.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({buckets.rejected.length})</TabsTrigger>
            <TabsTrigger value="other">Drafts ({buckets.other.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">{renderList(buckets.pending)}</TabsContent>
          <TabsContent value="approved" className="mt-4">{renderList(buckets.approved)}</TabsContent>
          <TabsContent value="rejected" className="mt-4">{renderList(buckets.rejected)}</TabsContent>
          <TabsContent value="other" className="mt-4">{renderList(buckets.other)}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
