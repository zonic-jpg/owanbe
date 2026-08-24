import { supabase } from "@/integrations/supabase/client";

const SAMPLE_CITY = "Lagos";
const SAMPLE_GUESTS = 250;

// Categories included in the demo budget (must match vendor_category enum)
const CATEGORIES = [
  "venue", "catering", "decor", "photography", "dj", "mc",
  "makeup", "aso_ebi", "cake", "drinks", "souvenirs",
] as const;

const TIERS = ["gold", "platinum", "diamond"] as const;
type Tier = typeof TIERS[number];

const TIER_SUMMARY: Record<Tier, string> = {
  gold: "Elegant essentials for a beautifully executed Owanbe — every guest leaves smiling.",
  platinum: "Premium upgrades across the board. Cinematic visuals, lavish menu, top-shelf vendors.",
  diamond: "Show-stopping luxury. Imported florals, celebrity vendors, next-level guest experience.",
};

const NICE_NAMES: Record<string, string> = {
  venue: "Venue & hall rental",
  catering: "Catering & live food stations",
  decor: "Decor, florals & stage design",
  photography: "Photography & videography",
  dj: "DJ & live sound",
  mc: "Master of ceremonies",
  makeup: "Bridal makeup & glam team",
  aso_ebi: "Aso-ebi fabric package",
  cake: "Cake & dessert table",
  drinks: "Bar, drinks & cocktails",
  souvenirs: "Guest souvenirs & gift bags",
};

const NGN = (n: number) => Math.round(n);

export async function createSampleEvent(userId: string): Promise<{ eventId: string; tiers: number; items: number }> {
  // 1. Create event
  const eventDate = new Date();
  eventDate.setMonth(eventDate.getMonth() + 3);

  const { data: ev, error: evErr } = await supabase
    .from("events")
    .insert({
      owner_id: userId,
      name: "Sample Owanbe — Adunni & Tunde",
      type: "wedding",
      city: SAMPLE_CITY,
      guest_count: SAMPLE_GUESTS,
      event_date: eventDate.toISOString().slice(0, 10),
      budget_min: 8_000_000,
      budget_max: 25_000_000,
      vibe: "Royal Yoruba glamour with modern minimalist accents",
      colors: ["#7B1E2C", "#D4AF37", "#FFF8E7"],
      notes: "Demo event auto-generated to showcase tiers, budget builder and marketplace.",
      status: "draft",
    })
    .select("id")
    .single();
  if (evErr || !ev) throw new Error(evErr?.message ?? "Failed to create event");

  // 2. Pull pricing rules for this city
  const { data: rules, error: rulesErr } = await supabase
    .from("service_price_config")
    .select("service, tier_level, base_price_per_guest, base_flat_price")
    .eq("city", SAMPLE_CITY)
    .eq("is_active", true);
  if (rulesErr) throw new Error(rulesErr.message);

  // 3. Pull approved vendors for this city, grouped by category
  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name, category, price_band, rating")
    .eq("city", SAMPLE_CITY)
    .eq("is_approved", true)
    .order("rating", { ascending: false });

  const vendorsByCatBand = new Map<string, string>(); // key = `${cat}:${band}` -> vendor id
  for (const v of vendors ?? []) {
    const key = `${v.category}:${v.price_band}`;
    if (!vendorsByCatBand.has(key)) vendorsByCatBand.set(key, v.id);
  }
  const fallbackVendorByCat = new Map<string, string>();
  for (const v of vendors ?? []) {
    if (!fallbackVendorByCat.has(v.category)) fallbackVendorByCat.set(v.category, v.id);
  }

  const tierToBand: Record<Tier, string> = { gold: "mid", platinum: "premium", diamond: "luxury" };

  // 4. Build tiers + budget items
  let totalItems = 0;
  for (const level of TIERS) {
    let tierTotal = 0;
    const items: Array<Record<string, unknown>> = [];

    for (let i = 0; i < CATEGORIES.length; i++) {
      const cat = CATEGORIES[i];
      const rule = (rules ?? []).find((r) => r.service === cat && r.tier_level === level);
      if (!rule) continue;
      const unit = rule.base_price_per_guest > 0 ? rule.base_price_per_guest : rule.base_flat_price;
      const qty = rule.base_price_per_guest > 0 ? SAMPLE_GUESTS : 1;
      const subtotal = unit * qty;
      tierTotal += subtotal;

      const band = tierToBand[level];
      const vendorId = vendorsByCatBand.get(`${cat}:${band}`) ?? fallbackVendorByCat.get(cat) ?? null;

      items.push({
        name: NICE_NAMES[cat] ?? cat,
        category: cat,
        qty,
        unit_price: NGN(unit),
        description: rule.base_price_per_guest > 0 ? `${SAMPLE_GUESTS} guests @ ₦${unit.toLocaleString()}` : "Flat package",
        vendor_id: vendorId,
        position: i,
      });
    }

    const { data: tier, error: tErr } = await supabase
      .from("tiers")
      .insert({ event_id: ev.id, level, total_estimate: tierTotal, summary: TIER_SUMMARY[level] })
      .select("id")
      .single();
    if (tErr || !tier) throw new Error(tErr?.message ?? "Failed to create tier");

    if (items.length) {
      const { error: itErr } = await supabase
        .from("budget_items")
        .insert(items.map((it) => ({ ...it, tier_id: tier.id })) as import("@/integrations/supabase/types").Database["public"]["Tables"]["event_selections"]["Insert"][]);
      if (itErr) throw new Error(itErr.message);
      totalItems += items.length;
    }
  }

  // 5. Mark platinum as the selected tier (mid choice)
  await supabase.from("events").update({ selected_tier: "platinum" }).eq("id", ev.id);

  return { eventId: ev.id, tiers: TIERS.length, items: totalItems };
}
