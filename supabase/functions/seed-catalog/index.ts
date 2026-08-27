// Seeds the catalog_products table with a curated demo catalog.
// Idempotent: upserts on (city, category, name).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Seed = {
  name: string;
  description: string;
  unit_label: string;
  unit_price: number;
  rating?: number;
  attributes?: Record<string, unknown>;
  image_keyword: string;
};

// Helper: African event / celebration photography (Unsplash, royalty-free)
const OWANBE_IMAGES: Record<string, string> = {
  planner: "photo-1519741497674-611481863552",
  proposal: "photo-1511285560929-80b456fea0bc",
  mc: "photo-1519225421980-715cb0215aed",
  alaga: "photo-1465495976277-4387d4b0b4c6",
  venue: "photo-1519167758481-83f550bb49b8",
  rentals: "photo-1464366400600-7168b8d9d6bd",
  logistics: "photo-1522673600700-279dd2f50337",
  transport: "photo-1558618666-fcd25c85cd64",
  security: "photo-1522673600700-279dd2f50337",
  catering: "photo-1555939594-58d7cb561ad1",
  cake: "photo-1464349095430-e847a1521986",
  drinks: "photo-1514362545857-3bc1654d0a04",
  decor: "photo-1478146896989-b5916d645276",
  flowers: "photo-1492684223066-81342ee5ff30",
  photo: "photo-1511285560929-80b456fea0bc",
  video: "photo-1492691527719-9d1e072312ec",
  dj: "photo-1571266028247-e4733b01795e",
  band: "photo-1493225457124-a3eb161ffa5f",
  asoebi: "photo-1573496359142-b8d87734a5a2",
  makeup: "photo-1522335789203-aabd1fc54bc9",
  hair: "photo-1522337360788-8b13dee7a37e",
  fashion: "photo-1595777457583-faa945f5f948",
  gifts: "photo-1513885535751-8b9238bd345a",
  default: "photo-1591604466374-42e045186142",
};
const img = (slug: string) => {
  const prefix = slug.split("-")[0] ?? "default";
  const photoId = OWANBE_IMAGES[prefix] ?? OWANBE_IMAGES.default;
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&h=600&q=80`;
};

export const CATALOG: Record<string, Seed[]> = {
  // PLANNING & COORDINATION
  planner: [
    { name: "No Wahala Weddings — Full Plan", description: "End-to-end wedding planning. Vendor curation, timeline, day-of coordination.", unit_label: "flat", unit_price: 1_500_000, rating: 4.9, attributes: { tier: "premium" }, image_keyword: "planner-noWahala" },
    { name: "Day-Of Coordination by Lola Events", description: "Day-of run-show coordination. We take the stress; you enjoy.", unit_label: "flat", unit_price: 450_000, rating: 4.7, image_keyword: "planner-lola" },
    { name: "Royal Affair Planners — Diamond Plan", description: "Full luxury planning with on-call concierge for VIPs.", unit_label: "flat", unit_price: 3_200_000, rating: 5.0, attributes: { tier: "luxury" }, image_keyword: "planner-royal" },
    { name: "Aso Oke Planners — Cultural Specialist", description: "Yoruba traditional + white wedding combo planning.", unit_label: "flat", unit_price: 1_100_000, rating: 4.8, image_keyword: "planner-asooke" },
    { name: "Budget Bliss Planning", description: "Smart planning for couples watching every Naira.", unit_label: "flat", unit_price: 280_000, rating: 4.4, image_keyword: "planner-budget" },
  ],
  proposal_planner: [
    { name: "Pop The Question — Sunset Beach", description: "Private beach proposal with photographer & live sax.", unit_label: "flat", unit_price: 850_000, rating: 4.9, image_keyword: "prop-beach" },
    { name: "Rooftop Romance Setup", description: "Lagos skyline rooftop with floral arch and string lights.", unit_label: "flat", unit_price: 620_000, rating: 4.8, image_keyword: "prop-rooftop" },
    { name: "Cinema Surprise Proposal", description: "Custom trailer screening at a private cinema.", unit_label: "flat", unit_price: 480_000, rating: 4.7, image_keyword: "prop-cinema" },
    { name: "Garden Picnic Pop-Up", description: "Boho garden picnic with charcuterie & live guitarist.", unit_label: "flat", unit_price: 350_000, rating: 4.6, image_keyword: "prop-picnic" },
  ],
  mc: [
    { name: "MC Lighthouse — Premium Bilingual", description: "Yoruba/English MC with 12 years owanbe experience.", unit_label: "flat", unit_price: 600_000, rating: 4.9, image_keyword: "mc-light" },
    { name: "Compere Tobi", description: "Energetic young MC. Great for under-40 crowd.", unit_label: "flat", unit_price: 280_000, rating: 4.7, image_keyword: "mc-tobi" },
    { name: "Aunty Ronke — Traditional MC", description: "Veteran traditional MC for engagement ceremonies.", unit_label: "flat", unit_price: 350_000, rating: 4.8, image_keyword: "mc-ronke" },
    { name: "MC Klassic + Hype Man Combo", description: "Two-man combo: MC anchors, hype man works the floor.", unit_label: "flat", unit_price: 750_000, rating: 4.9, image_keyword: "mc-klassic" },
  ],
  alaga: [
    { name: "Alaga Iduro Iyabo", description: "Veteran groom-side alaga. Full 3-hour engagement command.", unit_label: "flat", unit_price: 250_000, rating: 4.9, image_keyword: "alaga-iyabo" },
    { name: "Alaga Ijoko Bisi", description: "Bride-side alaga. Bilingual chants and prayers.", unit_label: "flat", unit_price: 250_000, rating: 4.8, image_keyword: "alaga-bisi" },
    { name: "Alaga Duo — Iyabo & Bisi Package", description: "Both sides covered. Best value bundle.", unit_label: "flat", unit_price: 450_000, rating: 4.95, attributes: { bundle: true }, image_keyword: "alaga-duo" },
  ],

  // VENUE & LOGISTICS
  venue: [
    { name: "Eko Hotel Convention Centre", description: "Iconic 1500-capacity hall on Victoria Island.", unit_label: "flat", unit_price: 8_500_000, rating: 4.9, attributes: { capacity: 1500, parking: true }, image_keyword: "venue-eko" },
    { name: "The Civic Centre Lagos", description: "Waterfront banquet hall, 800 capacity.", unit_label: "flat", unit_price: 5_200_000, rating: 4.8, attributes: { capacity: 800 }, image_keyword: "venue-civic" },
    { name: "Harbour Point", description: "Lagoon-view garden venue, 600 capacity.", unit_label: "flat", unit_price: 3_500_000, rating: 4.7, attributes: { capacity: 600, outdoor: true }, image_keyword: "venue-harbour" },
    { name: "Landmark Event Centre", description: "Beachfront luxury venue, up to 2000 guests.", unit_label: "flat", unit_price: 12_000_000, rating: 5.0, attributes: { capacity: 2000 }, image_keyword: "venue-landmark" },
    { name: "Federal Palace Hotel Ballroom", description: "Classic 5-star ballroom, 700 capacity.", unit_label: "flat", unit_price: 6_800_000, rating: 4.8, attributes: { capacity: 700 }, image_keyword: "venue-federal" },
  ],
  rentals: [
    { name: "Chiavari Chair (gold)", description: "Premium gold chiavari chair with cushion.", unit_label: "per chair", unit_price: 2_500, rating: 4.7, image_keyword: "rent-chiavari" },
    { name: "Round Table 10-seater", description: "Linen-dressed round table.", unit_label: "per table", unit_price: 12_000, rating: 4.6, image_keyword: "rent-table" },
    { name: "20×20 Marquee Tent", description: "Premium clear-roof marquee with side walls.", unit_label: "flat", unit_price: 380_000, rating: 4.7, image_keyword: "rent-marquee" },
    { name: "VIP Lounge Set (sofa + table)", description: "Luxury lounge cluster for high table.", unit_label: "per set", unit_price: 65_000, rating: 4.8, image_keyword: "rent-lounge" },
  ],
  logistics: [
    { name: "Day-Of Ushers Crew (10 ushers)", description: "Trained, uniformed ushers for guest management.", unit_label: "flat", unit_price: 180_000, rating: 4.7, image_keyword: "log-ushers" },
    { name: "Valet Parking Service", description: "10-valet team with cones, vests and tickets.", unit_label: "flat", unit_price: 250_000, rating: 4.6, image_keyword: "log-valet" },
    { name: "Full Day-Of Logistics Crew", description: "Stage, runner, ushers, parking — one captain.", unit_label: "flat", unit_price: 520_000, rating: 4.8, image_keyword: "log-full" },
  ],
  transport: [
    { name: "Mercedes S-Class Bridal Car", description: "Chauffeured S-Class for the couple, 6 hours.", unit_label: "flat", unit_price: 350_000, rating: 4.9, image_keyword: "trans-sclass" },
    { name: "Rolls-Royce Phantom (4 hrs)", description: "Iconic bridal Rolls. Chauffeur included.", unit_label: "flat", unit_price: 1_200_000, rating: 5.0, attributes: { tier: "luxury" }, image_keyword: "trans-rolls" },
    { name: "32-Seater Coaster Bus", description: "AC coaster for guest shuttle.", unit_label: "per bus", unit_price: 180_000, rating: 4.5, image_keyword: "trans-coaster" },
    { name: "Vintage Open-Top Convertible", description: "Classic convertible for the after-party drive.", unit_label: "flat", unit_price: 480_000, rating: 4.7, image_keyword: "trans-vintage" },
  ],
  security: [
    { name: "Standard Bouncer Crew (6)", description: "6 trained bouncers. 8-hour shift.", unit_label: "flat", unit_price: 220_000, rating: 4.6, image_keyword: "sec-std" },
    { name: "VIP Close-Protection (2 agents)", description: "Plain-clothes close protection for the couple.", unit_label: "flat", unit_price: 380_000, rating: 4.8, image_keyword: "sec-vip" },
    { name: "Police Escort (2 officers)", description: "2 uniformed officers for added presence.", unit_label: "flat", unit_price: 280_000, rating: 4.5, image_keyword: "sec-police" },
  ],

  // FOOD & DRINK
  catering: [
    { name: "Mama Cass Continental Buffet", description: "Jollof, fried rice, asun, salad and grills.", unit_label: "per guest", unit_price: 8_500, rating: 4.8, attributes: { style: "buffet" }, image_keyword: "cat-mama" },
    { name: "Sweet Sensation Premium Plated", description: "Plated 3-course service for high-table guests.", unit_label: "per guest", unit_price: 14_000, rating: 4.7, attributes: { style: "plated" }, image_keyword: "cat-sweet" },
    { name: "Live Suya & Grill Station", description: "Live suya, peppered chicken, fish — chef on site.", unit_label: "per guest", unit_price: 6_500, rating: 4.9, attributes: { style: "live_station" }, image_keyword: "cat-suya" },
    { name: "Royal Yoruba Banquet", description: "Amala, ewedu, abula, gbegiri — full Yoruba spread.", unit_label: "per guest", unit_price: 9_500, rating: 4.85, image_keyword: "cat-royal" },
    { name: "Vegan & Halal Combo Menu", description: "Inclusive menu with vegan, halal and kosher options.", unit_label: "per guest", unit_price: 11_000, rating: 4.7, image_keyword: "cat-vegan" },
  ],
  small_chops: [
    { name: "Classic Small Chops Tray (50pcs)", description: "Puff puff, samosa, spring rolls, gizdodo.", unit_label: "per tray", unit_price: 18_000, rating: 4.7, image_keyword: "sc-classic" },
    { name: "Premium Cocktail Box (80pcs)", description: "Sliders, prawn skewers, plantain mille-feuille.", unit_label: "per box", unit_price: 35_000, rating: 4.9, image_keyword: "sc-premium" },
    { name: "Live Small Chops Station", description: "Chef serves hot bites from a styled cart.", unit_label: "flat", unit_price: 380_000, rating: 4.8, image_keyword: "sc-live" },
  ],
  bar_service: [
    { name: "Mixology Cart — 2 Bartenders", description: "Signature cocktails, fresh garnishes, branded menu.", unit_label: "flat", unit_price: 450_000, rating: 4.8, image_keyword: "bar-mixology" },
    { name: "Standard Open Bar Service", description: "2 bartenders, ice, glassware, mixers (drinks not included).", unit_label: "flat", unit_price: 280_000, rating: 4.5, image_keyword: "bar-std" },
    { name: "Mobile Tiki Bar Experience", description: "Themed tropical bar with 3 mixologists.", unit_label: "flat", unit_price: 620_000, rating: 4.9, image_keyword: "bar-tiki" },
  ],
  drinks: [
    { name: "Moët & Chandon Brut Impérial", description: "Iconic French champagne. Per bottle.", unit_label: "per bottle", unit_price: 75_000, rating: 4.9, attributes: { type: "champagne", origin: "France" }, image_keyword: "dr-moet" },
    { name: "Veuve Clicquot Yellow Label", description: "Premium champagne loved by Lagos crowd.", unit_label: "per bottle", unit_price: 95_000, rating: 4.95, attributes: { type: "champagne", origin: "France" }, image_keyword: "dr-veuve" },
    { name: "Dom Pérignon Vintage", description: "Show-stopping luxury champagne.", unit_label: "per bottle", unit_price: 350_000, rating: 5.0, attributes: { type: "champagne", origin: "France", tier: "luxury" }, image_keyword: "dr-dom" },
    { name: "Hennessy VS Cognac", description: "Classic cognac for the elders' high table.", unit_label: "per bottle", unit_price: 65_000, rating: 4.8, attributes: { type: "cognac" }, image_keyword: "dr-hennessy" },
    { name: "Star Lager Crate (24)", description: "Crate of 24 Star Lager bottles.", unit_label: "per crate", unit_price: 18_000, rating: 4.5, attributes: { type: "beer" }, image_keyword: "dr-star" },
    { name: "Fresh Juice Bar (Zobo, Chapman, Tigernut)", description: "Per-guest unlimited juice bar.", unit_label: "per guest", unit_price: 1_800, rating: 4.7, attributes: { type: "non-alcoholic" }, image_keyword: "dr-juice" },
  ],
  cake: [
    { name: "3-Tier Buttercream Wedding Cake", description: "Vanilla & red velvet. Serves 150.", unit_label: "flat", unit_price: 280_000, rating: 4.8, attributes: { tiers: 3, serves: 150 }, image_keyword: "cake-3tier" },
    { name: "5-Tier Royal Fondant Cake", description: "Sugar-flower hand-crafted. Serves 350.", unit_label: "flat", unit_price: 850_000, rating: 4.95, attributes: { tiers: 5, serves: 350 }, image_keyword: "cake-5tier" },
    { name: "7-Tier Statement Cake", description: "Towering centerpiece. Includes plinth & lights.", unit_label: "flat", unit_price: 1_500_000, rating: 5.0, attributes: { tiers: 7, serves: 600, tier: "luxury" }, image_keyword: "cake-7tier" },
    { name: "Naked Rustic Drip Cake", description: "Trendy 4-tier with chocolate drip & fresh florals.", unit_label: "flat", unit_price: 380_000, rating: 4.7, image_keyword: "cake-naked" },
  ],
  dessert_table: [
    { name: "Petite Pastel Dessert Table", description: "Macarons, cupcakes, mini tarts. Serves 200.", unit_label: "flat", unit_price: 280_000, rating: 4.7, image_keyword: "des-pastel" },
    { name: "Chocolate Lovers Wall", description: "Themed chocolate fountain & truffle wall.", unit_label: "flat", unit_price: 420_000, rating: 4.9, image_keyword: "des-choc" },
    { name: "Donut Wall (100 donuts)", description: "Custom donut wall with names monogram.", unit_label: "flat", unit_price: 180_000, rating: 4.6, image_keyword: "des-donut" },
  ],

  // DECOR & PRODUCTION
  decor: [
    { name: "Royal Garden Decor by Tinuke", description: "Lush florals, drapes, lit walkway, bridal throne.", unit_label: "flat", unit_price: 2_800_000, rating: 4.9, image_keyword: "dec-royal" },
    { name: "Minimalist White Concept", description: "Clean modern monochrome with statement floral arch.", unit_label: "flat", unit_price: 1_500_000, rating: 4.7, image_keyword: "dec-min" },
    { name: "Aso-Ebi Burgundy & Gold", description: "Full burgundy and gold theme — drapes, florals, table.", unit_label: "flat", unit_price: 2_100_000, rating: 4.85, image_keyword: "dec-burg" },
    { name: "Diamond Crystal Glam Decor", description: "Crystal chandeliers, mirror tables, silver accents.", unit_label: "flat", unit_price: 4_500_000, rating: 4.95, attributes: { tier: "luxury" }, image_keyword: "dec-crystal" },
  ],
  florist: [
    { name: "Bridal Bouquet — Imported Roses", description: "Lush imported white & blush rose bouquet.", unit_label: "per bouquet", unit_price: 85_000, rating: 4.9, attributes: { style: "classic" }, image_keyword: "flo-bouquet" },
    { name: "Cascade Tropical Bouquet", description: "Anthuriums, monstera, orchid cascade.", unit_label: "per bouquet", unit_price: 110_000, rating: 4.8, attributes: { style: "tropical" }, image_keyword: "flo-cascade" },
    { name: "Wild Boho Bouquet", description: "Pampas, eucalyptus, dried palms boho mix.", unit_label: "per bouquet", unit_price: 65_000, rating: 4.7, attributes: { style: "boho" }, image_keyword: "flo-boho" },
    { name: "Bridesmaids Bouquet (set of 6)", description: "Coordinating posies for the bridal train.", unit_label: "per set", unit_price: 220_000, rating: 4.8, image_keyword: "flo-brides" },
    { name: "Floral Arch & Aisle Pieces", description: "Full ceremony arch + 12 aisle florals.", unit_label: "flat", unit_price: 850_000, rating: 4.9, image_keyword: "flo-arch" },
  ],
  lighting_av: [
    { name: "Premium Sound + Stage AV", description: "Line array, monitors, mixer, 2 wireless mics.", unit_label: "flat", unit_price: 480_000, rating: 4.8, image_keyword: "av-prem" },
    { name: "LED Uplighting Pack (24 lights)", description: "Color-matched architectural uplighting.", unit_label: "flat", unit_price: 220_000, rating: 4.7, image_keyword: "av-uplight" },
    { name: "LED Dance-Floor + Disco Pack", description: "Interactive floor + moving heads + smoke.", unit_label: "flat", unit_price: 580_000, rating: 4.9, image_keyword: "av-disco" },
    { name: "Live Stream Production (3 cameras)", description: "3-cam live stream to YouTube/IG with switcher.", unit_label: "flat", unit_price: 750_000, rating: 4.8, image_keyword: "av-stream" },
  ],
  stationery: [
    { name: "Letterpress Invitations (200)", description: "Premium letterpress invites with envelope and seal.", unit_label: "per 200", unit_price: 380_000, rating: 4.9, image_keyword: "stn-letter" },
    { name: "Acrylic Save-The-Date (200)", description: "Modern acrylic STDs with gold foiling.", unit_label: "per 200", unit_price: 280_000, rating: 4.8, image_keyword: "stn-acrylic" },
    { name: "Digital E-Invite + RSVP Site", description: "Custom website with RSVP tracking.", unit_label: "flat", unit_price: 180_000, rating: 4.7, image_keyword: "stn-digital" },
  ],
  fireworks: [
    { name: "Cold Spark Fountain (4 units)", description: "Indoor-safe cold spark for first dance.", unit_label: "flat", unit_price: 320_000, rating: 4.8, image_keyword: "fire-cold" },
    { name: "Outdoor Pyro Show (2 mins)", description: "Choreographed outdoor pyrotechnic finale.", unit_label: "flat", unit_price: 850_000, rating: 4.95, image_keyword: "fire-pyro" },
    { name: "100 Sparkler Send-Off Pack", description: "100 sparklers + holders for guest send-off.", unit_label: "flat", unit_price: 95_000, rating: 4.6, image_keyword: "fire-sparkle" },
  ],

  // PHOTO & VIDEO
  photography: [
    { name: "Tope Shots — Editorial Coverage", description: "8 hours, 600+ edited photos, online gallery.", unit_label: "flat", unit_price: 850_000, rating: 4.95, image_keyword: "ph-tope" },
    { name: "Lagos Lensmen Standard Package", description: "6 hours, 400 edited photos, 50 prints.", unit_label: "flat", unit_price: 480_000, rating: 4.7, image_keyword: "ph-std" },
    { name: "Diamond 2-Photographer Coverage", description: "Two-photographer team, full-day, premium album.", unit_label: "flat", unit_price: 1_500_000, rating: 5.0, attributes: { tier: "luxury" }, image_keyword: "ph-diamond" },
    { name: "Engagement Pre-Shoot Add-On", description: "2-hour styled engagement session.", unit_label: "flat", unit_price: 220_000, rating: 4.8, image_keyword: "ph-engage" },
  ],
  videographer: [
    { name: "Cinematic Highlight Film", description: "5-min cinematic edit + 30-min full film.", unit_label: "flat", unit_price: 950_000, rating: 4.9, image_keyword: "vid-cine" },
    { name: "Drone + Same-Day Edit", description: "Aerial drone shots + 90-second SDE played live.", unit_label: "flat", unit_price: 1_200_000, rating: 4.95, image_keyword: "vid-drone" },
    { name: "Standard Video Coverage", description: "Single-camera 6 hours + 20-min edit.", unit_label: "flat", unit_price: 380_000, rating: 4.6, image_keyword: "vid-std" },
  ],
  photo_booth: [
    { name: "360 Slow-Motion Booth", description: "Branded 360 video booth with attendant.", unit_label: "flat", unit_price: 380_000, rating: 4.9, image_keyword: "pb-360" },
    { name: "Classic Print Photo Booth", description: "Unlimited prints with custom backdrop.", unit_label: "flat", unit_price: 220_000, rating: 4.7, image_keyword: "pb-print" },
    { name: "AI Magic Mirror Booth", description: "Touchscreen AR mirror booth with prints.", unit_label: "flat", unit_price: 320_000, rating: 4.8, image_keyword: "pb-mirror" },
  ],

  // BEAUTY & FASHION
  makeup: [
    { name: "Banke Meshida-Lawal Bridal Glam", description: "Celebrity bridal MUA. Full bridal & touch-ups.", unit_label: "flat", unit_price: 850_000, rating: 5.0, attributes: { tier: "celebrity" }, image_keyword: "mua-bml" },
    { name: "Soft Glam Bridal Look", description: "Trending soft glam by mid-tier MUA.", unit_label: "flat", unit_price: 280_000, rating: 4.7, image_keyword: "mua-soft" },
    { name: "Trad + White Combo Glam", description: "Two distinct looks for trad and white.", unit_label: "flat", unit_price: 420_000, rating: 4.85, image_keyword: "mua-combo" },
    { name: "Bridal Train Makeup (per face)", description: "Per-face MUA service for bridesmaids.", unit_label: "per face", unit_price: 35_000, rating: 4.7, image_keyword: "mua-train" },
  ],
  hair_stylist: [
    { name: "Closure Wig Install (premium)", description: "HD closure install + styling.", unit_label: "flat", unit_price: 180_000, rating: 4.8, image_keyword: "hair-closure" },
    { name: "Frontal Wig + Curls", description: "Lace frontal install + barrel curls.", unit_label: "flat", unit_price: 220_000, rating: 4.85, image_keyword: "hair-frontal" },
    { name: "Bridal Updo Styling", description: "Sleek bridal updo with hair piece.", unit_label: "flat", unit_price: 120_000, rating: 4.7, image_keyword: "hair-updo" },
  ],
  bridal_wear: [
    { name: "Custom Imported Bridal Gown", description: "Made-to-measure imported lace bridal gown.", unit_label: "flat", unit_price: 1_800_000, rating: 4.9, image_keyword: "bw-import" },
    { name: "Local Couture Bridal Dress", description: "Designed locally by celebrity stylist.", unit_label: "flat", unit_price: 950_000, rating: 4.85, image_keyword: "bw-local" },
    { name: "Reception Sparkle Dress", description: "Second-look sparkle dress for reception.", unit_label: "flat", unit_price: 480_000, rating: 4.7, image_keyword: "bw-recep" },
  ],
  groom_attire: [
    { name: "Imported 3-Piece Tuxedo", description: "Italian wool 3-piece tuxedo, fitted.", unit_label: "flat", unit_price: 850_000, rating: 4.9, image_keyword: "ga-tux" },
    { name: "Royal Agbada (Hand-Embroidered)", description: "Senator-grade agbada with cap & shoes.", unit_label: "flat", unit_price: 650_000, rating: 4.9, image_keyword: "ga-agbada" },
    { name: "Modern Slim Suit", description: "Contemporary slim-cut 2-piece suit.", unit_label: "flat", unit_price: 280_000, rating: 4.6, image_keyword: "ga-slim" },
  ],
  gele: [
    { name: "Auto-Gele (premium)", description: "Pre-tied auto gele for guest convenience.", unit_label: "per gele", unit_price: 18_000, rating: 4.8, image_keyword: "gele-auto" },
    { name: "Hand-Tied Gele Specialist", description: "Specialist comes on-site to tie 30 geles.", unit_label: "flat", unit_price: 220_000, rating: 4.85, image_keyword: "gele-hand" },
    { name: "Statement Bridal Gele", description: "Show-stopping bridal gele with ornaments.", unit_label: "flat", unit_price: 65_000, rating: 4.9, image_keyword: "gele-bridal" },
  ],
  jewellery: [
    { name: "Coral Bead Bridal Set", description: "Authentic coral bead set: necklace, earrings, bangles.", unit_label: "per set", unit_price: 480_000, rating: 4.9, image_keyword: "jw-coral" },
    { name: "18k Gold Wedding Bands (pair)", description: "Solid 18k gold pair of wedding bands.", unit_label: "per pair", unit_price: 850_000, rating: 5.0, image_keyword: "jw-bands" },
    { name: "Stone & Pearl Bridal Set", description: "Crystal & freshwater pearl bridal jewellery set.", unit_label: "per set", unit_price: 280_000, rating: 4.7, image_keyword: "jw-pearl" },
  ],
  aso_ebi: [
    { name: "Premium Swiss Voile Lace", description: "Top-grade Swiss lace per yard. Min 2 yards.", unit_label: "per yard", unit_price: 35_000, rating: 4.85, attributes: { fabric: "lace" }, image_keyword: "ase-swiss" },
    { name: "Sequinned French Lace", description: "Sparkly sequinned French lace.", unit_label: "per yard", unit_price: 28_000, rating: 4.8, attributes: { fabric: "lace" }, image_keyword: "ase-french" },
    { name: "Aso-Oke Hand-Woven (Etu)", description: "Heritage hand-woven aso-oke etu set.", unit_label: "per set", unit_price: 180_000, rating: 4.95, attributes: { fabric: "aso_oke" }, image_keyword: "ase-asooke" },
    { name: "Ankara Premium Wax Print", description: "Vlisco-grade ankara, full piece (6 yards).", unit_label: "per piece", unit_price: 45_000, rating: 4.7, attributes: { fabric: "ankara" }, image_keyword: "ase-ankara" },
  ],

  // ENTERTAINMENT & EXTRAS
  dj: [
    { name: "DJ Spinall — Headline Set", description: "Celebrity DJ 3-hour headline performance.", unit_label: "flat", unit_price: 4_500_000, rating: 5.0, attributes: { tier: "celebrity" }, image_keyword: "dj-spinall" },
    { name: "DJ Consequence Premium Set", description: "Top-tier Lagos DJ. Full 6-hour set.", unit_label: "flat", unit_price: 1_800_000, rating: 4.9, image_keyword: "dj-conseq" },
    { name: "Resident DJ — Standard Set", description: "Reliable mid-tier DJ. 6-hour set with lights.", unit_label: "flat", unit_price: 380_000, rating: 4.7, image_keyword: "dj-std" },
    { name: "Live Band + DJ Combo", description: "9-piece highlife band + DJ for in-between.", unit_label: "flat", unit_price: 1_200_000, rating: 4.85, image_keyword: "dj-band" },
  ],
  kids_entertainment: [
    { name: "Bouncy Castle + Attendant", description: "Large bouncy castle with safety attendant.", unit_label: "flat", unit_price: 120_000, rating: 4.7, image_keyword: "kid-bounce" },
    { name: "Kids Corner — Full Setup", description: "Bouncy castle + face paint + balloon artist.", unit_label: "flat", unit_price: 280_000, rating: 4.9, image_keyword: "kid-full" },
    { name: "Magician + Storyteller", description: "Hour-long magic & story session for kids.", unit_label: "flat", unit_price: 95_000, rating: 4.7, image_keyword: "kid-mag" },
  ],
  souvenirs: [
    { name: "Branded Wine Glass Set (200)", description: "Couple-monogrammed glasses in gift box.", unit_label: "per 200", unit_price: 380_000, rating: 4.7, image_keyword: "sv-glass" },
    { name: "Personalised Asoebi Tote (200)", description: "Branded canvas tote in aso-ebi colours.", unit_label: "per 200", unit_price: 280_000, rating: 4.6, image_keyword: "sv-tote" },
    { name: "Mini Ankara Hand Fan (200)", description: "Wooden-handle hand fans in ankara prints.", unit_label: "per 200", unit_price: 180_000, rating: 4.5, image_keyword: "sv-fan" },
    { name: "Luxury Scented Candle (200)", description: "Branded soy candles with custom scent.", unit_label: "per 200", unit_price: 480_000, rating: 4.85, image_keyword: "sv-candle" },
  ],
};

// Top-up entries: ensures every category ships with at least 5 products.
export const PAD: Record<string, Seed[]> = {
  proposal_planner: [
    { name: "Yacht Sunset Proposal", description: "Private yacht charter on the Lagos lagoon with floral setup.", unit_label: "flat", unit_price: 1_200_000, rating: 4.95, image_keyword: "prop-yacht" },
  ],
  mc: [
    { name: "MC Akin Owanbe Veteran", description: "20-year veteran owanbe MC. Bilingual.", unit_label: "flat", unit_price: 480_000, rating: 4.85, image_keyword: "mc-akin" },
  ],
  alaga: [
    { name: "Alaga Toun — Premium Trad MC", description: "Cultural authority, prayers, full engagement chants.", unit_label: "flat", unit_price: 320_000, rating: 4.9, image_keyword: "alaga-toun" },
    { name: "Alaga Bunmi — Bilingual Bride-Side", description: "Smooth bilingual bride-side alaga.", unit_label: "flat", unit_price: 280_000, rating: 4.8, image_keyword: "alaga-bunmi" },
  ],
  rentals: [
    { name: "Crystal Ghost Chair", description: "Acrylic ghost chair for modern decor themes.", unit_label: "per chair", unit_price: 3_500, rating: 4.7, image_keyword: "rent-ghost" },
  ],
  logistics: [
    { name: "Day-Of Wedding Coordinator + Runner", description: "Lead coordinator with assistant runner.", unit_label: "flat", unit_price: 320_000, rating: 4.8, image_keyword: "log-coord" },
    { name: "Souvenir Distribution Crew (8)", description: "Branded crew handling souvenirs at exits.", unit_label: "flat", unit_price: 140_000, rating: 4.6, image_keyword: "log-souv" },
  ],
  transport: [
    { name: "G-Wagon Bridal Convoy", description: "Pair of G-Wagons with chauffeurs for bridal convoy.", unit_label: "flat", unit_price: 680_000, rating: 4.85, image_keyword: "trans-gwagon" },
  ],
  security: [
    { name: "Metal Detector + Door Crew", description: "Walk-through detector with 4-person door crew.", unit_label: "flat", unit_price: 320_000, rating: 4.7, image_keyword: "sec-detector" },
    { name: "Premium Mixed Security Package", description: "Bouncers, plain-clothes & police escort bundle.", unit_label: "flat", unit_price: 580_000, rating: 4.85, image_keyword: "sec-mixed" },
  ],
  small_chops: [
    { name: "Vegan Small Chops Tray (50pcs)", description: "Plant-based finger food tray.", unit_label: "per tray", unit_price: 22_000, rating: 4.7, image_keyword: "sc-vegan" },
    { name: "Suya Skewer Tray (40pcs)", description: "Hot suya skewers with yaji and onions.", unit_label: "per tray", unit_price: 26_000, rating: 4.85, image_keyword: "sc-suya" },
  ],
  bar_service: [
    { name: "Champagne Tower Service", description: "Hand-built coupé tower with attendant.", unit_label: "flat", unit_price: 380_000, rating: 4.85, image_keyword: "bar-tower" },
    { name: "Wine Sommelier Pairing Service", description: "Sommelier-led tasting at the high table.", unit_label: "flat", unit_price: 520_000, rating: 4.8, image_keyword: "bar-somm" },
  ],
  cake: [
    { name: "Cupcake Tower (200 cupcakes)", description: "Tiered cupcake tower with custom toppers.", unit_label: "flat", unit_price: 220_000, rating: 4.7, image_keyword: "cake-cupcake" },
  ],
  dessert_table: [
    { name: "Ice-Cream Cart (200 servings)", description: "Branded ice-cream cart with attendant.", unit_label: "flat", unit_price: 240_000, rating: 4.7, image_keyword: "des-icecream" },
    { name: "Macaron & Tart Tower", description: "Pastel macaron and fresh-fruit tart tower.", unit_label: "flat", unit_price: 320_000, rating: 4.8, image_keyword: "des-macaron" },
  ],
  decor: [
    { name: "Tropical Garden Glow", description: "Lush palms, string-lit canopy and live foliage.", unit_label: "flat", unit_price: 1_900_000, rating: 4.8, image_keyword: "dec-trop" },
  ],
  lighting_av: [
    { name: "Pixel-Mapped Stage Backdrop", description: "Programmable LED pixel backdrop with content.", unit_label: "flat", unit_price: 850_000, rating: 4.9, image_keyword: "av-pixel" },
  ],
  stationery: [
    { name: "Velvet Box Invitation Suite (200)", description: "Velvet-lined gift box invites with wax seal.", unit_label: "per 200", unit_price: 520_000, rating: 4.9, image_keyword: "stn-velvet" },
    { name: "Programme Booklets (200)", description: "Printed programme booklets with custom artwork.", unit_label: "per 200", unit_price: 140_000, rating: 4.6, image_keyword: "stn-prog" },
  ],
  fireworks: [
    { name: "Confetti Cannon Pack (8 cannons)", description: "CO2 confetti cannons for first-dance moment.", unit_label: "flat", unit_price: 180_000, rating: 4.7, image_keyword: "fire-confetti" },
    { name: "Indoor Smoke + Cold Spark Combo", description: "Low-fog plus cold spark for grand entrance.", unit_label: "flat", unit_price: 280_000, rating: 4.8, image_keyword: "fire-smoke" },
  ],
  photography: [
    { name: "Documentary Style Coverage", description: "Candid documentary 8 hours + slim album.", unit_label: "flat", unit_price: 620_000, rating: 4.8, image_keyword: "ph-doc" },
  ],
  videographer: [
    { name: "Cinematic Trad + White Combo Film", description: "Two-event cinematic edit with teaser reel.", unit_label: "flat", unit_price: 1_400_000, rating: 4.9, image_keyword: "vid-combo" },
    { name: "Social-Cuts Reels Pack (5 reels)", description: "Five vertical reels delivered within 72 hours.", unit_label: "flat", unit_price: 280_000, rating: 4.7, image_keyword: "vid-reels" },
  ],
  photo_booth: [
    { name: "Vintage VW Camper Photo Booth", description: "Themed VW camper turned photo booth.", unit_label: "flat", unit_price: 420_000, rating: 4.85, image_keyword: "pb-vw" },
    { name: "Glam Mirror with Beauty Filters", description: "Standing mirror booth with glam filters.", unit_label: "flat", unit_price: 260_000, rating: 4.7, image_keyword: "pb-glam" },
  ],
  makeup: [
    { name: "Mother-of-the-Couple Makeover", description: "Two looks for both mothers, includes gele tying.", unit_label: "flat", unit_price: 220_000, rating: 4.8, image_keyword: "mua-mother" },
  ],
  hair_stylist: [
    { name: "Bridal Train Hair (set of 6)", description: "Coordinated styling for bridesmaids.", unit_label: "per set", unit_price: 240_000, rating: 4.8, image_keyword: "hair-train" },
    { name: "Traditional Threading & Beads", description: "Yoruba-inspired threading with bead accents.", unit_label: "flat", unit_price: 95_000, rating: 4.7, image_keyword: "hair-thread" },
  ],
  bridal_wear: [
    { name: "Boho Lace Bridal Gown", description: "Light, flowing boho lace gown for outdoor weddings.", unit_label: "flat", unit_price: 720_000, rating: 4.75, image_keyword: "bw-boho" },
    { name: "Trad Iro & Buba Set (Aso-Oke)", description: "Hand-woven aso-oke iro & buba bridal set.", unit_label: "flat", unit_price: 580_000, rating: 4.9, image_keyword: "bw-trad" },
  ],
  groom_attire: [
    { name: "Aso-Oke Agbada Combo (Groom)", description: "Hand-woven aso-oke agbada with cap & shoes.", unit_label: "flat", unit_price: 480_000, rating: 4.85, image_keyword: "ga-asooke" },
    { name: "Bespoke Linen Suit", description: "Tailored linen suit for warm-weather weddings.", unit_label: "flat", unit_price: 320_000, rating: 4.7, image_keyword: "ga-linen" },
  ],
  gele: [
    { name: "Gele Class for Bridal Train", description: "On-site class teaching the train to tie geles.", unit_label: "flat", unit_price: 120_000, rating: 4.7, image_keyword: "gele-class" },
    { name: "Premium Aso-Oke Gele (per piece)", description: "Hand-finished aso-oke gele per piece.", unit_label: "per gele", unit_price: 25_000, rating: 4.85, image_keyword: "gele-asooke" },
  ],
  jewellery: [
    { name: "Beaded Headpiece + Choker Set", description: "Coral-and-gold headpiece with matching choker.", unit_label: "per set", unit_price: 180_000, rating: 4.75, image_keyword: "jw-bead" },
    { name: "Diamond Tennis Bracelet", description: "Lab-grown diamond tennis bracelet.", unit_label: "per piece", unit_price: 620_000, rating: 4.9, image_keyword: "jw-tennis" },
  ],
  aso_ebi: [
    { name: "Adire Heritage Print", description: "Hand-dyed adire piece, 6 yards.", unit_label: "per piece", unit_price: 38_000, rating: 4.8, attributes: { fabric: "adire" }, image_keyword: "ase-adire" },
  ],
  dj: [
    { name: "Afrobeats Vinyl-Only DJ Set", description: "Niche vinyl Afrobeats DJ for sophisticated crowd.", unit_label: "flat", unit_price: 520_000, rating: 4.8, image_keyword: "dj-vinyl" },
  ],
  kids_entertainment: [
    { name: "Soft Play Area + Attendants", description: "Padded soft-play zone for under-5s with attendants.", unit_label: "flat", unit_price: 220_000, rating: 4.8, image_keyword: "kid-soft" },
    { name: "Costume Character Visits (2 hrs)", description: "Themed costumed characters for kids' photo ops.", unit_label: "flat", unit_price: 180_000, rating: 4.75, image_keyword: "kid-character" },
  ],
  souvenirs: [
    { name: "Edible Honey Jar Favors (200)", description: "Mini honey jars with custom couple labels.", unit_label: "per 200", unit_price: 220_000, rating: 4.7, image_keyword: "sv-honey" },
  ],
};

// Merge PAD into CATALOG so every category has at least 5 products.
for (const [cat, extras] of Object.entries(PAD)) {
  CATALOG[cat] = [...(CATALOG[cat] ?? []), ...extras];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Verify caller is an admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id).in("role", ["admin", "super_admin"]).maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const city = "Lagos";
    const rows: Array<Record<string, unknown>> = [];
    for (const [category, products] of Object.entries(CATALOG)) {
      products.forEach((p, idx) =>
        rows.push({
          category,
          city,
          name: p.name,
          description: p.description,
          unit_label: p.unit_label,
          unit_price: p.unit_price,
          rating: p.rating ?? 4.6,
          is_featured: idx === 0,
          attributes: p.attributes ?? {},
          image_url: img(p.image_keyword),
          origin: "mock",
        })
      );
    }

    // Manual upsert by (city, category, name) — no unique constraint needed
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const { data: existing } = await admin
        .from("catalog_products")
        .select("id")
        .eq("city", row.city)
        .eq("category", row.category)
        .eq("name", row.name)
        .maybeSingle();
      if (existing) {
        const { error } = await admin.from("catalog_products").update(row).eq("id", existing.id);
        if (!error) updated++;
      } else {
        const { error } = await admin.from("catalog_products").insert(row);
        if (!error) inserted++;
      }
    }

    return new Response(JSON.stringify({ ok: true, inserted, updated, total: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as { message?: string })?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
