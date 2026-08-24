import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, User as UserIcon, Save, LogOut } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(120),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  avatar_url: z.string().trim().url("Must be a valid URL").max(500).optional().or(z.literal("")),
});

export default function Profile() {
  const { user, roles, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", city: "", phone: "", avatar_url: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { document.title = "Profile — Owanbe Planner"; }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          city: data.city ?? "",
          phone: data.phone ?? "",
          avatar_url: data.avatar_url ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  if (!user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const f: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { f[i.path[0] as string] = i.message; });
      setErrors(f);
      return;
    }
    setErrors({});
    setSaving(true);
    const d = parsed.data;
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: d.full_name,
      city: d.city || null,
      phone: d.phone || null,
      avatar_url: d.avatar_url || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
  };

  const initials = (form.full_name || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <AppShell>
      <div className="container max-w-2xl py-8 md:py-12 space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UserIcon className="h-4 w-4" /> Account
          </div>
          <h1 className="font-display text-3xl md:text-4xl">Your profile</h1>
          <p className="text-muted-foreground">Update your name, city, phone and avatar.</p>
        </header>

        {loading ? (
          <Skeleton className="h-96 w-full rounded-xl" />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {form.avatar_url ? <AvatarImage src={form.avatar_url} alt={form.full_name || "Avatar"} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">{form.full_name || "Unnamed"}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {roles.length === 0 && <Badge variant="secondary">user</Badge>}
                    {roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input id="full_name" value={form.full_name} maxLength={120}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                  {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={form.city} maxLength={80}
                      onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lagos" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={form.phone} maxLength={40}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234…" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="avatar">Avatar URL</Label>
                  <Input id="avatar" type="url" value={form.avatar_url} maxLength={500}
                    onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
                  {errors.avatar_url && <p className="text-sm text-destructive">{errors.avatar_url}</p>}
                </div>
                <Separator />
                <div className="flex justify-between gap-2 flex-wrap">
                  <Button type="button" variant="ghost" onClick={() => signOut()}>
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
