import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroEventBg from "@/assets/hero-event-bg.jpg";
import tablescape from "@/assets/apple-tablescape.jpg";
import danceImg from "@/assets/apple-dance.jpg";
import venueImg from "@/assets/apple-venue.jpg";

// Fallback values keep the landing page rendering even before DB load / for SSR-ish first paint.
const DEFAULTS: Record<string, string> = {
  "hero.eyebrow": "The Owanbe Planner",
  "hero.title.line1": "Plan Your Owanbe.",
  "hero.title.line2": "Engage The Best.",
  "hero.title.line3": "Live It Out.",
  "hero.subtitle":
    "From venue to caterers, aso ebi to bands — design every detail of a Nigerian wedding, birthday or funeral.",
  "hero.subtitle.bold": "Vetted vendors. Top 3 picks per category. Live Naira totals as you choose.",
  "hero.cta.primary": "Create your event",
  "hero.cta.secondary": "Browse vendors",
  "hero.image": heroEventBg,
  "card.venue.eyebrow": "AI Visuals",
  "card.venue.title": "See your venue\nbefore you book it.",
  "card.venue.body": "Render decor in your colors. Test the vibe. Skip the regret.",
  "card.venue.image": venueImg,
  "card.vendors.eyebrow": "Vendors",
  "card.vendors.title": "Vetted.\nCurated.\nBooked.",
  "card.vendors.image": tablescape,
  "card.budget.eyebrow": "Smart Budgets",
  "card.budget.title": "Pick.\nCompare.\nTotal.",
  "card.budget.body":
    "Browse the top 3 vetted options in every category — venues, caterers, DJs, decor and more. Compare prices side-by-side and watch your full Naira total update live as you build the perfect day, all without breaking your budget.",
  "card.family.eyebrow": "Family Mode",
  "card.family.title": "Auntie\napproved.",
  "card.family.body":
    "Invite the whole family to share, vote and comment on every choice — bring everyone in without the endless WhatsApp chaos.",
  "card.joy.eyebrow": "The day",
  "card.joy.title": "Pure joy,\non schedule.",
  "card.joy.image": danceImg,
  "cta.final.line1": "Your celebration.",
  "cta.final.line2": "Bigger than ever.",
  "cta.final.body": "Built in Nigeria, for the way we celebrate.",
  "cta.final.button": "Plan my Owanbe",
  "footer.tagline": "Owanbe Planner · Made in Nigeria",
};

// Map DB-stored bundled paths back to actual imported asset URLs so swapped images keep working.
const ASSET_MAP: Record<string, string> = {
  "/src/assets/hero-event-bg.jpg": heroEventBg,
  "/src/assets/apple-tablescape.jpg": tablescape,
  "/src/assets/apple-dance.jpg": danceImg,
  "/src/assets/apple-venue.jpg": venueImg,
};

export function useLandingContent() {
  const [content, setContent] = useState<Record<string, string>>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from("landing_content").select("key, value, kind");
        if (cancelled || !data) return;
        const next: Record<string, string> = { ...DEFAULTS };
        for (const r of data as { key: string; value: string; kind: string }[]) {
          let v = r.value;
          if (r.kind === "image" && ASSET_MAP[v]) v = ASSET_MAP[v];
          next[r.key] = v;
        }
        setContent(next);
      } catch {
        /* Keep DEFAULTS when Supabase is unreachable. */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const t = (k: string) => content[k] ?? DEFAULTS[k] ?? "";
  return { t, content };
}
