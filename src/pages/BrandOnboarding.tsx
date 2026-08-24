import { useEffect, useState } from "react";
import { startBrandPayment, verifyPaymentReturn } from "@/lib/zonicme-pay";
import { track as zonicTrack } from "@/lib/zonic-track";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, CheckCircle2, Building2, CreditCard, Send, Crown, Tag, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { BRAND_PLANS, type BrandPlanId } from "@/lib/brand-plans";
import { formatNaira } from "@/lib/format";

const brandSchema = z.object({
  name: z.string().trim().min(2, "Brand name required").max(120),
  contact_email: z.string().trim().email("Valid email required").max(255),
  contact_phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().url("Must be a valid URL").max(255).optional().or(z.literal("")),
  bio: z.string().trim().max(1500).optional().or(z.literal("")),
});

type Brand = {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  bio: string | null;
  status: "draft" | "awaiting_payment" | "awaiting_approval" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null;
  logo_url: string | null;
};

type Subscription = {
  id: string; plan: "monthly" | "annual"; status: string;
  is_waived: boolean; period_end: string;
};

export default function BrandOnboarding() {
  const { user, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => { document.title = "Become a brand — Owanbe Planner"; }, []);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: b } = await supabase.from("brands").select("*").eq("owner_id", user.id).maybeSingle();
    setBrand(b as Brand | null);
    if (b) {
      const { data: s } = await supabase
        .from("brand_subscriptions").select("id, plan, status, is_waived, period_end")
        .eq("brand_id", b.id)
        .in("status", ["active", "waived"])
        .gt("period_end", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      setSub(s as Subscription | null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // If we've returned from the payment gateway, verify and refresh.
  useEffect(() => {
    (async () => {
      const r = await verifyPaymentReturn();
      if (!r) return;
      if (r.ok) { toast.success("Payment confirmed — your plan is now active."); zonicTrack("purchase", { entity: { type: "brand_subscription" } }); }
      else toast.error(r.error ?? "We couldn't confirm that payment.");
      window.history.replaceState({}, "", "/brand/onboarding");
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  return (
    <AppShell>
      <div className="container max-w-3xl py-8 md:py-12 space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" /> Brand portal
          </div>
          <h1 className="font-display text-3xl md:text-4xl">List your brand on Owanbe Planner</h1>
          <p className="text-muted-foreground">
            Reach thousands of couples and event planners. Subscribe, set up your profile, then submit for approval.
          </p>
        </header>

        {loading ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : (
          <Steps brand={brand} sub={sub} onChange={async () => { await load(); await refreshRoles(); }} />
        )}

        {brand?.status === "approved" && (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <div className="font-semibold">Your brand is live!</div>
                  <p className="text-sm text-muted-foreground">View your analytics dashboard.</p>
                </div>
              </div>
              <Button onClick={() => navigate("/brand")}>Open dashboard</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Steps({ brand, sub, onChange }: { brand: Brand | null; sub: Subscription | null; onChange: () => Promise<void> }) {
  const hasActiveSub = !!sub;
  const step1Done = !!brand;
  const step2Done = hasActiveSub;
  const step3Done = !!brand && brand.status !== "draft" && brand.status !== "awaiting_payment";

  return (
    <div className="space-y-6">
      <Step n={1} title="Create your brand record" done={step1Done} active={!step1Done}>
        <BrandForm brand={brand} onSaved={onChange} />
      </Step>
      <Step n={2} title="Choose a plan" done={step2Done} active={step1Done && !step2Done}>
        {brand
          ? <PlanPicker brand={brand} sub={sub} onChange={onChange} />
          : <p className="text-sm text-muted-foreground">Save your brand details first.</p>}
      </Step>
      <Step n={3} title="Submit for approval" done={step3Done} active={step1Done && step2Done && !step3Done}>
        {brand && <SubmitBlock brand={brand} canSubmit={hasActiveSub} onChange={onChange} />}
      </Step>
    </div>
  );
}

function Step({ n, title, done, active, children }: { n: number; title: string; done: boolean; active: boolean; children: React.ReactNode }) {
  return (
    <Card className={done ? "border-emerald-500/30" : active ? "border-primary/40 ring-1 ring-primary/20" : "opacity-70"}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {done ? <CheckCircle2 className="h-4 w-4" /> : n}
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function BrandForm({ brand, onSaved }: { brand: Brand | null; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: brand?.name ?? "",
    contact_email: brand?.contact_email ?? user?.email ?? "",
    contact_phone: brand?.contact_phone ?? "",
    website: brand?.website ?? "",
    bio: brand?.bio ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const editable = !brand || brand.status === "draft" || brand.status === "rejected" || brand.status === "awaiting_payment";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = brandSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const d = parsed.data;
    const payload = {
      name: d.name,
      contact_email: d.contact_email,
      contact_phone: d.contact_phone || null,
      website: d.website || null,
      bio: d.bio || null,
    };
    if (brand) {
      const { error } = await supabase.from("brands").update(payload).eq("id", brand.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Brand updated");
    } else {
      const { error } = await supabase.from("brands").insert([{ ...payload, owner_id: user.id, status: "awaiting_payment" }]);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Brand created");
    }
    setSaving(false);
    await onSaved();
  };

  if (brand && !editable) {
    return (
      <div className="space-y-2 text-sm">
        <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{brand.name}</span></div>
        <div><span className="text-muted-foreground">Email:</span> {brand.contact_email}</div>
        {brand.website && <div><span className="text-muted-foreground">Website:</span> {brand.website}</div>}
        <Badge variant="secondary" className="mt-2">Locked while {brand.status.replace("_", " ")}</Badge>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Brand name" id="b-name" error={errors.name}>
        <Input id="b-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} required />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Contact email" id="b-email" error={errors.contact_email}>
          <Input id="b-email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} maxLength={255} required />
        </Field>
        <Field label="Phone (optional)" id="b-phone" error={errors.contact_phone}>
          <Input id="b-phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} maxLength={40} />
        </Field>
      </div>
      <Field label="Website (optional)" id="b-web" error={errors.website}>
        <Input id="b-web" type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} maxLength={255} />
      </Field>
      <Field label="About your brand (optional)" id="b-bio" error={errors.bio}>
        <Textarea id="b-bio" rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={1500} />
      </Field>
      {brand?.status === "rejected" && brand.rejection_reason && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription><strong>Rejected:</strong> {brand.rejection_reason}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {brand ? "Save changes" : "Create brand"}
      </Button>
    </form>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function PlanPicker({ brand, sub, onChange }: { brand: Brand; sub: Subscription | null; onChange: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<BrandPlanId | "waiver" | null>(null);

  if (sub) {
    const remaining = Math.max(0, Math.ceil((new Date(sub.period_end).getTime() - Date.now()) / 86_400_000));
    const planMeta = BRAND_PLANS[sub.plan];
    return (
      <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {sub.is_waived ? <Crown className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            <div>
              <div className="font-medium capitalize">{sub.is_waived ? "Fees waived" : `${sub.plan} plan active`}</div>
              <p className="text-sm text-muted-foreground">
                {sub.is_waived ? "No payment required" : `${formatNaira(planMeta.price)} ${planMeta.period}`}
                {" · "}{remaining} day{remaining === 1 ? "" : "s"} remaining
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="capitalize">{sub.status}</Badge>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/brand"><CreditCard className="h-4 w-4 mr-2" /> Manage plan &amp; billing</Link>
        </Button>
      </div>
    );
  }

  const tryWaiver = async () => {
    setBusy("waiver");
    const { data, error } = await supabase.rpc("apply_waiver_to_brand", { _brand: brand.id, _code: code || null });
    setBusy(null);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("No matching waiver found for your brand name, email, or code.");
    toast.success("Waiver applied — you can skip payment.");
    await onChange();
  };

  const mockPay = async (planId: BrandPlanId) => {
    const plan = BRAND_PLANS[planId];
    setBusy(planId);
    const periodEnd = new Date(Date.now() + plan.periodDays * 86_400_000).toISOString();
    const { data: subRow, error: subErr } = await supabase.from("brand_subscriptions").insert({
      brand_id: brand.id, plan: planId, status: "active",
      amount: plan.price, period_end: periodEnd,
    }).select("id").single();
    if (subErr) { setBusy(null); return toast.error(subErr.message); }
    const { error: payErr } = await supabase.from("brand_payments").insert({
      brand_id: brand.id, subscription_id: subRow.id, amount: plan.price,
      status: "succeeded", method: "mock", external_ref: `MOCK-${Date.now()}`,
      paid_at: new Date().toISOString(),
    });
    setBusy(null);
    if (payErr) return toast.error(payErr.message);
    toast.success(`Payment of ${formatNaira(plan.price)} recorded (mock)`);
    await onChange();
  };

  // Real payment: routes through the shared ZonicMe payment interface
  // (Flutterwave default, Paystack fallback). Falls back to the mock only in
  // development when no provider keys are configured yet.
  const pay = async (planId: BrandPlanId) => {
    setBusy(planId);
    try {
      await startBrandPayment({
        brandId: brand.id,
        plan: planId,
        email: (brand as { contact_email?: string }).contact_email ?? undefined,
      });
      // On success the browser redirects to the gateway and back.
    } catch (e) {
      const msg = e?.message ?? "Could not start payment";
      if (import.meta.env.DEV && /not configured|provider/i.test(msg)) {
        await mockPay(planId);
        return;
      }
      toast.error(msg);
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.values(BRAND_PLANS).map((p) => (
          <button
            key={p.id}
            onClick={() => pay(p.id)}
            disabled={busy !== null}
            className="text-left rounded-xl border-2 p-4 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 group"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">{p.label}</div>
              {p.badge && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/20">{p.badge}</Badge>}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-display">{formatNaira(p.price)}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <div className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity group-disabled:opacity-50">
              {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {busy === p.id ? "Processing…" : "Choose & pay"}
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Tag className="h-4 w-4" /> Have a waiver?
        </div>
        <p className="text-xs text-muted-foreground">
          If an admin granted you a waiver by your <strong>brand name</strong>, <strong>email</strong>, or a <strong>code</strong>, click below.
          Optionally enter a code:
        </p>
        <div className="flex gap-2">
          <Input placeholder="Waiver code (optional)" value={code} onChange={(e) => setCode(e.target.value)} className="max-w-xs" />
          <Button variant="outline" onClick={tryWaiver} disabled={busy !== null}>
            {busy === "waiver" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Crown className="h-4 w-4 mr-2" />}
            Check waiver
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubmitBlock({ brand, canSubmit, onChange }: { brand: Brand; canSubmit: boolean; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  if (brand.status === "awaiting_approval") {
    return (
      <Alert>
        <Send className="h-4 w-4" />
        <AlertDescription>Submitted for approval. We'll notify you once it's reviewed.</AlertDescription>
      </Alert>
    );
  }
  if (brand.status === "approved") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> Approved and live
        <Link to="/brand" className="ml-2 underline">Go to dashboard →</Link>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("request_brand_approval", { _brand: brand.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted for approval");
    await onChange();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        When you're ready, submit your brand profile to admin for review. You'll be notified by email.
      </p>
      <Button onClick={submit} disabled={!canSubmit || busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Submit for approval
      </Button>
    </div>
  );
}
