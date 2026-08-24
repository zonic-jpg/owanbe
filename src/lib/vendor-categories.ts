// Centralised vendor category metadata used across directory + admin.
// Grouped to make the long category list scannable.

export const CATEGORY_GROUPS = [
  {
    label: "Planning & Coordination",
    categories: ["planner", "proposal_planner", "mc", "alaga"],
  },
  {
    label: "Venue & Logistics",
    categories: ["venue", "rentals", "logistics", "transport", "security"],
  },
  {
    label: "Food & Drink",
    categories: ["catering", "small_chops", "bar_service", "drinks", "cake", "dessert_table"],
  },
  {
    label: "Decor & Production",
    categories: ["decor", "florist", "lighting_av", "stationery", "fireworks"],
  },
  {
    label: "Photo & Video",
    categories: ["photography", "videographer", "photo_booth"],
  },
  {
    label: "Beauty & Fashion",
    categories: ["makeup", "hair_stylist", "bridal_wear", "groom_attire", "gele", "jewellery", "aso_ebi"],
  },
  {
    label: "Entertainment & Extras",
    categories: ["dj", "kids_entertainment", "souvenirs"],
  },
] as const;

export const ALL_CATEGORIES: string[] = CATEGORY_GROUPS.flatMap((g) => [...g.categories]);

// Search aliases — typing any of these in the search box selects the category.
export const CATEGORY_ALIASES: Record<string, string[]> = {
  planner: ["planner", "planning", "coordinator", "wedding planner"],
  proposal_planner: ["proposal", "proposal planner", "engagement"],
  mc: ["mc", "compere", "host", "anchor"],
  alaga: ["alaga", "alaga ijoko", "alaga iduro", "traditional mc"],
  venue: ["venue", "hall", "garden", "event centre", "event center"],
  rentals: ["rentals", "rental", "chairs", "tables", "marquee"],
  logistics: ["logistics", "ushers", "coordination day-of"],
  transport: ["transport", "car hire", "limo", "bus", "shuttle"],
  security: ["security", "bouncers", "guards"],
  catering: ["catering", "caterer", "food", "jollof"],
  small_chops: ["small chops", "smallchops", "puff puff", "samosa"],
  bar_service: ["bar", "bar service", "bartender", "mixology", "cocktail"],
  drinks: ["drinks", "wine", "champagne", "beverage"],
  cake: ["cake", "wedding cake", "baker"],
  dessert_table: ["dessert", "dessert table", "sweets", "donut wall"],
  decor: ["decor", "decoration", "draping", "stage"],
  florist: ["florist", "flowers", "bouquet"],
  lighting_av: ["lighting", "av", "sound", "led", "uplight"],
  stationery: ["stationery", "invites", "invitations", "save the date"],
  fireworks: ["fireworks", "sparklers", "cold spark", "pyro"],
  photography: ["photography", "photographer", "photo"],
  videographer: ["video", "videographer", "cinematography", "film"],
  photo_booth: ["photo booth", "360 booth", "selfie booth"],
  makeup: ["makeup", "mua", "beauty", "lashes"],
  hair_stylist: ["hair", "hair stylist", "wigs", "braids"],
  bridal_wear: ["bridal wear", "wedding dress", "bridal", "gown"],
  groom_attire: ["groom", "agbada", "suit", "tuxedo", "groom attire"],
  gele: ["gele", "headtie", "head tie", "auto gele"],
  jewellery: ["jewellery", "jewelry", "beads", "coral"],
  aso_ebi: ["aso ebi", "asoebi", "fabric", "lace"],
  dj: ["dj", "disc jockey", "music"],
  kids_entertainment: ["kids", "kids entertainment", "bouncy castle", "face paint"],
  souvenirs: ["souvenirs", "gifts", "favours", "favors", "ips"],
};

export const prettyCategory = (c: string) =>
  c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

/**
 * Return the category key whose name or alias EXACTLY matches the query, or null.
 *
 * Important: this only fires on an exact match of the whole query against a
 * category name or a known alias. It deliberately does NOT do substring
 * matching — a previous version did, which caused vendor-name searches like
 * "Savour Catering" to match the `lighting_av` alias "av" and be force-filtered
 * into the wrong category, returning zero results. Free-text search in the
 * directory handles partial/substring matches separately.
 */
export function matchCategoryFromQuery(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  for (const cat of ALL_CATEGORIES) {
    if (cat.replace(/_/g, " ") === q) return cat;
  }
  for (const [cat, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => a === q)) return cat;
  }
  return null;
}
