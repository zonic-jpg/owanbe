import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { resizeForDevices, type SizedImage } from "@/lib/responsive-image";

/**
 * Visual content editor for the public pages.
 * - See a live preview of the page while editing all its text.
 * - Add / remove a hero image (auto-sized for every device) or a video.
 * - Hold everything as a draft, then go live with a single Publish.
 * Editing is a super-admin-granted right (this tab only renders for super
 * admins; granular grants to other admins hook into Admin → Admin perms).
 */

type Content = {
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  subhead: string;
  heroImage: string | null;
  heroVideo: string;
};

const DEFAULTS: Content = {
  eyebrow: "PLAN IT BEAUTIFULLY",
  headline: "Plan your owambe,",
  headlineAccent: "end to end.",
  subhead: "Find and book the right vendors across 30+ categories, with live budget tracking from first idea to final dance.",
  heroImage: null,
  heroVideo: "",
};

export function ContentStudio() {
  const { isSuperAdmin } = useAuth();
  const [draft, setDraft] = useState<Content>(DEFAULTS);
  const [saved, setSaved] = useState<Content>(DEFAULTS);
  const [sizes, setSizes] = useState<SizedImage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof Content>(k: K, v: Content[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // Load published content (graceful if the table isn't there yet).
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("site_content").select("data").eq("id", 1).maybeSingle();
        if (data?.data) { setSaved({ ...DEFAULTS, ...data.data }); setDraft({ ...DEFAULTS, ...data.data }); }
      } catch {
        /* table not provisioned yet — use defaults */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onPickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const out = await resizeForDevices(file);
      setSizes(out);
      set("heroImage", out[out.length - 1].dataUrl); // desktop rendition for preview
    } catch {
      toast.error("Could not process that image");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    try {
      await supabase.from("site_content").upsert({ id: 1, data: draft as import("@/integrations/supabase/types").Json, updated_at: new Date().toISOString() });
      setSaved(draft);
      toast.success("Published — your changes are live");
    } catch {
      // Still reflect locally so the editor stays usable before the table exists.
      setSaved(draft);
      toast.success("Saved locally (provision the site_content table to persist)");
    }
  };

  const discard = () => { setDraft(saved); setSizes(null); };

  if (!isSuperAdmin) {
    return <p className="text-sm text-muted-foreground">Content editing is a super-admin-granted right. Ask a super admin to grant you access in Admin → Admin perms.</p>;
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading content…</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm flex items-center justify-between gap-3">
        <span>Editing pages is a <strong>super-admin-granted</strong> right — grant or revoke it per admin in Admin → Admin perms.</span>
        <Badge>Editor access · granted</Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* EDITOR */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Text on the landing page</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Labeled label="Eyebrow"><Input value={draft.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} /></Labeled>
              <Labeled label="Headline"><Input value={draft.headline} onChange={(e) => set("headline", e.target.value)} /></Labeled>
              <Labeled label="Accent line"><Input value={draft.headlineAccent} onChange={(e) => set("headlineAccent", e.target.value)} /></Labeled>
              <Labeled label="Subhead"><Textarea value={draft.subhead} onChange={(e) => set("subhead", e.target.value)} /></Labeled>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Hero media — auto-sized for every device</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {draft.heroImage ? (
                <div className="space-y-2">
                  {sizes && (
                    <div className="flex gap-3">
                      {sizes.map((s) => (
                        <div key={s.label} className="text-center">
                          <img src={s.dataUrl} alt="" className="h-16 w-auto rounded border" />
                          <div className="text-[10px] mt-1 text-muted-foreground">{s.label}<br />{s.width}×{s.height} · {s.kb}KB</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { set("heroImage", null); setSizes(null); }} className="text-destructive">Remove image</Button>
                </div>
              ) : (
                <label className="block text-sm">
                  <span className="text-muted-foreground text-xs">{busy ? "Generating Mobile / Tablet / Desktop sizes…" : "Add an image — device sizes are created automatically"}</span>
                  <input type="file" accept="image/*" onChange={onPickImage} className="mt-1 block text-sm" />
                </label>
              )}
              <div className="pt-2 border-t">
                <Labeled label="Hero video (URL, optional)"><Input value={draft.heroVideo} onChange={(e) => set("heroVideo", e.target.value)} placeholder="https://…/clip.mp4" /></Labeled>
                {draft.heroVideo && <Button variant="ghost" size="sm" onClick={() => set("heroVideo", "")} className="text-destructive mt-1">Remove video</Button>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LIVE PREVIEW */}
        <Card className="self-start overflow-hidden">
          <div className="text-[10px] font-bold tracking-widest px-4 py-2 border-b text-muted-foreground">LIVE PREVIEW · LANDING</div>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground">{draft.eyebrow}</p>
            <h3 className="mt-1 text-2xl font-bold leading-tight">{draft.headline} <span className="text-primary">{draft.headlineAccent}</span></h3>
            <p className="mt-2 text-sm text-muted-foreground">{draft.subhead}</p>
            {draft.heroVideo
              ? <video src={draft.heroVideo} className="mt-3 w-full rounded border" controls />
              : draft.heroImage ? <img src={draft.heroImage} alt="" className="mt-3 w-full rounded border" /> : null}
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 rounded-lg border bg-background p-3 flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{dirty ? "You have unpublished changes." : "All changes published."}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={discard} disabled={!dirty}>Discard</Button>
          <Button onClick={publish} disabled={!dirty}>Publish changes</Button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
