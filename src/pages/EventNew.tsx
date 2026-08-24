import { GateGuard } from "@/components/GateGuard";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ArrowLeft, ArrowRight, Calendar, MapPin, Users, Wallet, Palette } from "lucide-react";
import { toast } from "sonner";
import { track as zonicTrack } from "@/lib/zonic-track";
import { formatNairaCompact } from "@/lib/format";

type EventType = "wedding" | "birthday" | "burial" | "housewarming" | "chieftaincy" | "anniversary" | "naming" | "other";

const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: "wedding", label: "Wedding" },
  { id: "birthday", label: "Birthday" },
  { id: "burial", label: "Burial" },
  { id: "housewarming", label: "Housewarming" },
  { id: "chieftaincy", label: "Chieftaincy" },
  { id: "anniversary", label: "Anniversary" },
  { id: "naming", label: "Naming ceremony" },
  { id: "other", label: "Other" },
];

const COLOR_PALETTE = ["#7B1E2C", "#D4AF37", "#FFF8E7", "#1B3B6F", "#0E7C66", "#C75D2C", "#1F2937", "#F4C2C2", "#6B2D5C"];

const schema = z.object({
  name: z.string().trim().min(2, "Event name required").max(160),
  type: z.enum(["wedding", "birthday", "burial", "housewarming", "chieftaincy", "anniversary", "naming", "other"]),
  city: z.string().trim().min(1, "City required").max(80),
  event_date: z.string().optional().or(z.literal("")),
  guest_count: z.number().int().min(1, "At least 1").max(20000),
  budget_min: z.number().int().min(0),
  budget_max: z.number().int().min(0),
  vibe: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(1500).optional().or(z.literal("")),
}).refine((d) => d.budget_max >= d.budget_min, { path: ["budget_max"], message: "Max must be ≥ min" });

function EventNewInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "", type: "wedding" as EventType, city: "Lagos", event_date: "",
    guest_count: 200, budget_min: 5_000_000, budget_max: 15_000_000,
    vibe: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { document.title = "New event — Owanbe Planner"; }, []);

  if (!user) return null;

  const toggleColor = (c: string) => {
    setColors((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= 5 ? cur : [...cur, c]);
  };

  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (form.name.trim().length < 2) e.name = "Event name required";
      if (!form.type) e.type = "Pick a type";
    }
    if (s === 2) {
      if (!form.city.trim()) e.city = "City required";
      if (form.guest_count < 1) e.guest_count = "At least 1 guest";
    }
    if (s === 3) {
      if (form.budget_max < form.budget_min) e.budget_max = "Max must be ≥ min";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(4, s + 1)); };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const f: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { f[i.path[0] as string] = i.message; });
      setErrors(f);
      return;
    }
    setSaving(true);
    const d = parsed.data;
    const { data, error } = await supabase.from("events").insert({
      owner_id: user.id,
      name: d.name,
      type: d.type,
      city: d.city,
      event_date: d.event_date || null,
      guest_count: d.guest_count,
      budget_min: d.budget_min,
      budget_max: d.budget_max,
      vibe: d.vibe || null,
      colors: colors.length ? colors : null,
      notes: d.notes || null,
      status: "draft",
    }).select("id").single();
    setSaving(false);
    if (error || !data) return toast.error(error?.message ?? "Failed to create event");
    zonicTrack("event.created", {
      entity: { type: "event", id: data.id },
      properties: { type: d.type, city: d.city, guest_count: d.guest_count },
    });
    toast.success("Event created");
    navigate(`/events/${data.id}`);
  };

  return (
    <AppShell>
      <div className="container max-w-3xl py-8 md:py-12 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" /> New event
          </div>
          <h1 className="font-display text-3xl md:text-4xl">Plan your Owanbe</h1>
          <p className="text-muted-foreground">A few questions and we'll set up your budget and vendor matches.</p>
        </header>

        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center font-semibold ${
                n === step ? "bg-primary text-primary-foreground" :
                n < step ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}>{n}</div>
              {n < 4 && <div className={`h-px w-8 ${n < step ? "bg-emerald-500" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {step === 1 && "About the event"}
              {step === 2 && "Where & how big"}
              {step === 3 && "Budget"}
              {step === 4 && "Vibe & review"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Give your event a name and type."}
              {step === 2 && "Set city, date and expected guests."}
              {step === 3 && "We'll match vendors to your range."}
              {step === 4 && "Optional vibe + colours, then review."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Event name</Label>
                  <Input id="name" value={form.name} maxLength={160}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Adunni & Tunde's Wedding" />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {EVENT_TYPES.map((t) => (
                      <button key={t.id} type="button"
                        onClick={() => setForm({ ...form, type: t.id })}
                        className={`text-sm rounded-lg border p-2.5 text-left transition-colors ${
                          form.type === t.id ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted/50"
                        }`}>{t.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="city"><MapPin className="h-3.5 w-3.5 inline mr-1" />City</Label>
                    <Input id="city" value={form.city} maxLength={80}
                      onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lagos" />
                    {errors.city && <p className="text-sm text-destructive">{errors.city}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="date"><Calendar className="h-3.5 w-3.5 inline mr-1" />Date (optional)</Label>
                    <Input id="date" type="date" value={form.event_date}
                      onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guests"><Users className="h-3.5 w-3.5 inline mr-1" />Guests</Label>
                  <Input id="guests" type="number" min={1} max={20000} value={form.guest_count}
                    onChange={(e) => setForm({ ...form, guest_count: parseInt(e.target.value) || 0 })} />
                  {errors.guest_count && <p className="text-sm text-destructive">{errors.guest_count}</p>}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bmin"><Wallet className="h-3.5 w-3.5 inline mr-1" />Budget min (₦)</Label>
                    <Input id="bmin" type="number" min={0} step={100000} value={form.budget_min}
                      onChange={(e) => setForm({ ...form, budget_min: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bmax">Budget max (₦)</Label>
                    <Input id="bmax" type="number" min={0} step={100000} value={form.budget_max}
                      onChange={(e) => setForm({ ...form, budget_max: parseInt(e.target.value) || 0 })} />
                    {errors.budget_max && <p className="text-sm text-destructive">{errors.budget_max}</p>}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/30 border p-3 text-sm text-muted-foreground">
                  Range: <strong className="text-foreground">{formatNairaCompact(form.budget_min)} – {formatNairaCompact(form.budget_max)}</strong>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="vibe">Vibe (optional)</Label>
                  <Textarea id="vibe" rows={2} value={form.vibe} maxLength={500}
                    onChange={(e) => setForm({ ...form, vibe: e.target.value })}
                    placeholder="Royal Yoruba glamour with modern minimalist accents…" />
                </div>
                <div className="space-y-1.5">
                  <Label><Palette className="h-3.5 w-3.5 inline mr-1" />Colours (up to 5)</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button key={c} type="button" onClick={() => toggleColor(c)}
                        className={`h-9 w-9 rounded-full border-2 transition-all ${
                          colors.includes(c) ? "border-foreground scale-110" : "border-border hover:scale-105"
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Toggle ${c}`} />
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea id="notes" rows={3} value={form.notes} maxLength={1500}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-1 text-sm">
                  <div className="font-semibold mb-1">Review</div>
                  <div><span className="text-muted-foreground">Name:</span> {form.name || "—"}</div>
                  <div><span className="text-muted-foreground">Type:</span> {EVENT_TYPES.find((t) => t.id === form.type)?.label}</div>
                  <div><span className="text-muted-foreground">Location:</span> {form.city}{form.event_date ? ` · ${form.event_date}` : ""}</div>
                  <div><span className="text-muted-foreground">Guests:</span> {form.guest_count}</div>
                  <div><span className="text-muted-foreground">Budget:</span> {formatNairaCompact(form.budget_min)} – {formatNairaCompact(form.budget_max)}</div>
                  {colors.length > 0 && (
                    <div className="flex items-center gap-2"><span className="text-muted-foreground">Colours:</span>
                      {colors.map((c) => <Badge key={c} variant="outline" style={{ backgroundColor: c, color: "#fff", borderColor: c }}>•</Badge>)}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={step === 1 ? () => navigate("/dashboard") : back} disabled={saving}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {step === 1 ? "Cancel" : "Back"}
          </Button>
          {step < 4 ? (
            <Button onClick={next}>Next <ArrowRight className="h-4 w-4 ml-2" /></Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Create event
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function EventNew() {
  return (
    <GateGuard service="event_management" featureName="Full event management">
      <EventNewInner />
    </GateGuard>
  );
}
