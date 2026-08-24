// Background batch job: generate African-themed cover images for vendors.
// - Picks N vendors needing a cover (pending OR failed with attempts<3)
// - Generates via the configurable AI image provider (see ../_shared/ai.ts)
// - Uploads to the `vendor-covers` storage bucket
// - Updates vendors.cover_url + cover_status, and a cover_jobs progress row
//
// Diversity + dedupe pipeline (per category):
//   1. Pick the style variant whose (kind, gender) bucket is most under-represented
//      in the last N covers; tiebreak by least-recently-used variant id.
//   2. Generate the image, compute a 64-bit aHash (perceptual fingerprint).
//   3. If the new hash is within HAMMING_DUP_THRESHOLD bits of any existing
//      cover in the same category, retry with a different style variant
//      (up to DUP_RETRIES times) before accepting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decode as decodeJpeg } from "https://esm.sh/jpeg-js@0.4.4";
import { imageBytesFromAiResponse } from "../_shared/image-bytes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AI_IMAGE_URL = Deno.env.get("AI_IMAGE_URL") ?? Deno.env.get("AI_API_URL") ?? "https://api.openai.com/v1/chat/completions";
const AI_API_KEY = Deno.env.get("AI_API_KEY") ?? "";
const AI_IMAGE_MODEL = Deno.env.get("AI_IMAGE_MODEL") ?? "gpt-4o-mini";
const BUCKET = "vendor-covers";
const MAX_ATTEMPTS = 3;
const DUP_RETRIES = 2; // re-roll up to N times if too similar to existing
const HAMMING_DUP_THRESHOLD = 8; // <=8 bits differ on 64 → near-duplicate
const RECENT_WINDOW = 16; // covers per category considered for diversity

// Auto-rerun thresholds (post-batch QA)
const AUTO_RERUN_DUP_RATE = 0.25; // >25% of accepted images had to settle on a near-dup
const AUTO_RERUN_MIN_CATEGORY = 4; // category needs >=N covers before we judge diversity
const AUTO_RERUN_BUCKET_MIN_SHARE = 0.15; // any allowed bucket <15% share is under-represented
const AUTO_RERUN_MAX_VENDORS = 25; // cap auto-rerun batch size

// Subject-only prompts. Directory cards work best with a SINGLE focal
// subject and generous negative space.
const CATEGORY_PROMPTS: Record<string, string> = {
  decor: "a single elegantly draped table corner with one floral centrepiece",
  catering: "one plated portion of jollof rice with grilled protein on a ceramic plate",
  photography: "a single photographer holding a DSLR camera, framed from the chest up",
  dj: "one DJ standing behind a turntable with headphones around the neck",
  mc: "a single MC holding a microphone, calm confident portrait from the chest up",
  makeup: "one makeup artist holding a brush near a client's cheek, close crop",
  aso_ebi: "a single folded bolt of lace fabric resting on a wooden surface",
  cake: "one tiered wedding cake on a simple stand against a plain backdrop",
  venue: "one empty elegant event hall interior with a single set table in focus",
  drinks: "a single coupe glass of champagne on a clean surface",
  security: "a single security professional in a dark suit, calm portrait from the chest up",
  logistics: "one branded event van parked beside a single stack of crates",
  souvenirs: "a single branded souvenir item placed on a plain surface",
  planner: "one planner holding a clipboard, calm portrait from the chest up",
  florist: "a single hand-tied bouquet resting on a plain surface",
  videographer: "one videographer holding a gimbal-mounted camera, chest-up portrait",
  hair_stylist: "one hair stylist's hands shaping a finished hairstyle, close crop",
  bridal_wear: "a single bridal gown on a hanger against a plain wall",
  gele: "one gele headwrap, elegant portrait of a woman from the shoulders up",
  lighting_av: "a single par-can stage light beam against a dark plain backdrop",
  transport: "one classic car bonnet detail with a small ribbon, simple framing",
  stationery: "one folded invitation card lying on a plain textured surface",
  rentals: "a single chiavari chair against a plain backdrop",
  bar_service: "one bartender's hands stirring a single cocktail, close crop",
  groom_attire: "one groom in agbada, calm portrait from the chest up",
  jewellery: "a single strand of coral beads laid on a plain surface",
  small_chops: "a small ceramic bowl of puff puff on a plain surface",
  dessert_table: "one cupcake on a small cake stand against a plain backdrop",
  photo_booth: "a single instant photo print resting on a plain surface",
  fireworks: "one sparkler held in a hand against a dark plain backdrop",
  kids_entertainment: "a single colourful balloon tied to a chair against a plain wall",
  alaga: "one Alaga in iro and buba, calm portrait from the shoulders up",
  proposal_planner: "a single ring box open on a plain surface with one rose stem beside it",
};

// Categories whose subject is intrinsically gendered — never auto-swap gender.
const GENDER_LOCKED: Record<string, "woman" | "man"> = {
  bridal_wear: "woman",
  groom_attire: "man",
  gele: "woman",
  alaga: "woman",
};

// Categories that are objects/scenes (no human subject); object variants only.
const OBJECT_ONLY = new Set<string>([
  "decor", "catering", "aso_ebi", "cake", "venue", "drinks",
  "souvenirs", "florist", "bridal_wear", "lighting_av", "transport",
  "stationery", "rentals", "jewellery", "small_chops", "dessert_table",
  "photo_booth", "fireworks", "kids_entertainment", "proposal_planner",
]);

type SubjectKind = "person" | "object";
type SubjectGender = "woman" | "man" | "none";

interface StyleVariant {
  id: number;
  kind: SubjectKind;
  gender: SubjectGender;
  modifier: string;
}

// Compositional rotation. Each variant fixes a DIFFERENT axis (gender,
// attire colour, angle) so the same category never produces look-alikes.
const STYLE_VARIANTS: StyleVariant[] = [
  { id: 0, kind: "person", gender: "woman", modifier: "subject is a dark-skinned African woman wearing soft cream tones; eye-level portrait; warm natural window light; muted beige background; generous negative space on the right" },
  { id: 1, kind: "person", gender: "man",   modifier: "subject is a dark-skinned African man wearing deep charcoal tones; three-quarter angle; soft overcast daylight; muted stone-grey background; generous negative space on the left" },
  { id: 2, kind: "person", gender: "woman", modifier: "subject is a dark-skinned African woman wearing dusty olive tones; close-up crop; soft side light; muted clay-brown background; generous negative space above" },
  { id: 3, kind: "person", gender: "man",   modifier: "subject is a dark-skinned African man wearing warm terracotta tones; wide editorial framing; soft diffused daylight; muted ivory background; generous negative space around the subject" },
  { id: 4, kind: "person", gender: "woman", modifier: "subject is a dark-skinned African woman wearing muted indigo adire; eye-level half-portrait; soft golden-hour light; muted sand background; shallow depth of field" },
  { id: 5, kind: "person", gender: "man",   modifier: "subject is a dark-skinned African man wearing soft sage tones; low three-quarter angle; gentle tungsten light; muted espresso background; cinematic restraint" },
  { id: 6, kind: "object", gender: "none",  modifier: "object-only flatlay; top-down angle; soft diffused daylight; muted oat-coloured surface; ample negative space" },
  { id: 7, kind: "object", gender: "none",  modifier: "object-only side angle; soft window light; muted slate-grey backdrop; minimalist still-life composition" },
];

function variantsAllowedFor(category: string): StyleVariant[] {
  const locked = GENDER_LOCKED[category];
  if (OBJECT_ONLY.has(category)) {
    // Object categories: prefer object variants but allow gender-locked person variant if set.
    const objs = STYLE_VARIANTS.filter((v) => v.kind === "object");
    if (locked) {
      const persons = STYLE_VARIANTS.filter((v) => v.kind === "person" && v.gender === locked);
      return [...objs, ...persons];
    }
    return objs;
  }
  if (locked) return STYLE_VARIANTS.filter((v) => v.kind === "person" && v.gender === locked);
  return STYLE_VARIANTS;
}

function buildPrompt(category: string, vendorId: string, variant: StyleVariant): string {
  const subject = CATEGORY_PROMPTS[category] ?? `${category.replace(/_/g, " ")}`;
  const seed = vendorId.slice(0, 8);
  return [
    `Minimalist editorial photograph of ${subject}.`,
    `${variant.modifier}.`,
    `Authentic African context. Single clear focal point with strong negative space — never busy, never crowded, never a group.`,
    `Restrained palette of two or three muted, desaturated hues. Avoid bright, saturated, neon or rainbow colours.`,
    `Contextual depth comes from texture and lighting (e.g. raffia, linen, wood grain, adire, soft shadows) — not from extra people or props.`,
    `Unique composition; do not reuse common stock framings. Ultra detailed, no text, no watermark, no logos.`,
    `Variation token: ${seed}.`,
  ].join(" ");
}

// ---------- Perceptual hash (64-bit aHash on luminance) ----------
function aHashFromJpeg(bytes: Uint8Array): string | null {
  try {
    const img = decodeJpeg(bytes, { useTArray: true });
    const { data, width, height } = img; // RGBA
    const N = 8;
    const cellW = width / N;
    const cellH = height / N;
    const lum = new Array<number>(N * N);
    let sum = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const sx = Math.floor(x * cellW + cellW / 2);
        const sy = Math.floor(y * cellH + cellH / 2);
        const i = (sy * width + sx) * 4;
        // Rec. 709 luma
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        lum[y * N + x] = l;
        sum += l;
      }
    }
    const avg = sum / (N * N);
    let hex = "";
    for (let nibble = 0; nibble < 16; nibble++) {
      let v = 0;
      for (let b = 0; b < 4; b++) {
        if (lum[nibble * 4 + b] >= avg) v |= 1 << (3 - b);
      }
      hex += v.toString(16);
    }
    return hex; // 16 hex chars = 64 bits
  } catch (_e) {
    return null;
  }
}

function hammingHex(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist;
}

// Choose the variant whose (kind, gender) bucket is most under-represented
// in the recent window for this category; among ties pick least-recently-used.
async function pickStyleVariant(
  admin: SupabaseAdmin,
  category: string,
  fallbackSeed: string,
  exclude: Set<number> = new Set(),
): Promise<StyleVariant> {
  const allowed = variantsAllowedFor(category).filter((v) => !exclude.has(v.id));
  if (allowed.length === 0) {
    // Fall back to any allowed variant ignoring the exclude set.
    return variantsAllowedFor(category)[0] ?? STYLE_VARIANTS[0];
  }

  const { data: recent } = await admin
    .from("vendors")
    .select("cover_style_variant,cover_subject_kind,cover_subject_gender,cover_generated_at")
    .eq("category", category)
    .not("cover_style_variant", "is", null)
    .order("cover_generated_at", { ascending: false })
    .limit(RECENT_WINDOW);

  // Bucket counts
  const bucketCount = new Map<string, number>();
  const lastUsedRank = new Map<number, number>();
  (recent ?? []).forEach((r: { vendor_id: string }, idx: number) => {
    const key = `${r.cover_subject_kind ?? "?"}|${r.cover_subject_gender ?? "?"}`;
    bucketCount.set(key, (bucketCount.get(key) ?? 0) + 1);
    if (typeof r.cover_style_variant === "number" && !lastUsedRank.has(r.cover_style_variant)) {
      lastUsedRank.set(r.cover_style_variant, idx);
    }
  });

  const seedHash = Array.from(fallbackSeed).reduce(
    (h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0,
  );

  // Score each allowed variant: primary = bucket count (lower is better),
  // secondary = recency (higher rank / not in window is better),
  // tertiary = stable seed-based shuffle.
  const scored = allowed.map((v) => {
    const bk = `${v.kind}|${v.gender}`;
    const count = bucketCount.get(bk) ?? 0;
    const rank = lastUsedRank.has(v.id) ? lastUsedRank.get(v.id)! : RECENT_WINDOW;
    return { v, count, rank };
  });
  scored.sort((a, b) => {
    if (a.count !== b.count) return a.count - b.count;
    if (a.rank !== b.rank) return b.rank - a.rank; // older = better
    return ((Math.abs(seedHash) + a.v.id) % 7) - ((Math.abs(seedHash) + b.v.id) % 7);
  });
  return scored[0].v;
}

async function generateImage(prompt: string): Promise<Uint8Array> {
  if (!AI_API_KEY) {
    throw new Error("AI image not configured (AI_API_KEY missing) — vendors fall back to bundled stock covers");
  }
  let lastErr = "AI image request failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55_000);
      const resp = await fetch(AI_IMAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: AI_IMAGE_MODEL,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`AI image ${resp.status}: ${t.slice(0, 200)}`);
      }
      const data = await resp.json();
      return await imageBytesFromAiResponse(data);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      if (attempt === 0 && /abort|timeout|429|502|503|504/i.test(lastErr)) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      throw new Error(lastErr);
    }
  }
  throw new Error(lastErr);
}

async function uploadCover(supabase: SupabaseAdmin, vendorId: string, bytes: Uint8Array): Promise<string> {
  const path = `vendor/${vendorId}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`upload: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function nearestDuplicate(
  admin: SupabaseAdmin,
  category: string,
  vendorId: string,
  hash: string,
): Promise<{ minDist: number; vendorId?: string }> {
  const { data: existing } = await admin
    .from("vendors")
    .select("id,cover_phash")
    .eq("category", category)
    .neq("id", vendorId)
    .not("cover_phash", "is", null);
  let minDist = 64;
  let nearest: string | undefined;
  for (const row of existing ?? []) {
    const d = hammingHex(hash, row.cover_phash as string);
    if (d < minDist) { minDist = d; nearest = row.id; }
  }
  return { minDist, vendorId: nearest };
}

type SupabaseAdmin = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Authenticate caller and require admin role
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  if (!userRes?.user) {
    return new Response(JSON.stringify({ error: "Invalid auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await userClient.rpc("is_admin", { _user_id: userRes.user.id });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin only" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Math.max(Number(body.batch_size) || 50, 1), 50);
  const vendorIds: string[] | undefined = Array.isArray(body.vendor_ids)
    ? body.vendor_ids.filter((v: unknown) => typeof v === "string").slice(0, 50)
    : undefined;
  const isAutoRerun = body.auto_rerun === true; // suppress recursive auto-reruns

  let query = admin.from("vendors").select("id,name,category,cover_status,cover_attempts");
  if (vendorIds && vendorIds.length > 0) {
    query = query.in("id", vendorIds);
  } else {
    query = query.or(
      `cover_status.eq.pending,and(cover_status.eq.failed,cover_attempts.lt.${MAX_ATTEMPTS})`,
    );
  }
  const { data: vendors, error: pickErr } = await query
    .order("cover_attempts", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (pickErr) {
    return new Response(JSON.stringify({ error: pickErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: jobRow, error: jobErr } = await admin
    .from("cover_jobs")
    .insert({ batch_size: batchSize, triggered_by: userRes.user.id, status: "running" })
    .select("id").single();
  if (jobErr) {
    return new Response(JSON.stringify({ error: jobErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const jobId = jobRow.id;

  let succeeded = 0;
  let failed = 0;
  let dupRejections = 0;

  for (const v of vendors ?? []) {
    try {
      let acceptedBytes: Uint8Array | null = null;
      let acceptedHash: string | null = null;
      let acceptedVariant: StyleVariant | null = null;
      const tried = new Set<number>();

      for (let attempt = 0; attempt <= DUP_RETRIES; attempt++) {
        const variant = await pickStyleVariant(admin, v.category, v.id, tried);
        tried.add(variant.id);
        const bytes = await generateImage(buildPrompt(v.category, v.id, variant));
        const hash = aHashFromJpeg(bytes);
        if (!hash) {
          // Could not decode (unexpected) — accept anyway on last attempt.
          if (attempt === DUP_RETRIES) {
            acceptedBytes = bytes; acceptedVariant = variant; acceptedHash = null; break;
          }
          continue;
        }
        const { minDist } = await nearestDuplicate(admin, v.category, v.id, hash);
        if (minDist > HAMMING_DUP_THRESHOLD || attempt === DUP_RETRIES) {
          acceptedBytes = bytes; acceptedHash = hash; acceptedVariant = variant;
          if (minDist <= HAMMING_DUP_THRESHOLD) dupRejections++; // accepted only because we ran out of retries
          break;
        }
        dupRejections++;
        console.log(
          `dedupe: vendor ${v.id} cat ${v.category} variant ${variant.id} too similar (dist=${minDist}); retrying`,
        );
      }

      if (!acceptedBytes || !acceptedVariant) throw new Error("No image accepted");
      const url = await uploadCover(admin, v.id, acceptedBytes);
      await admin
        .from("vendors")
        .update({
          cover_url: url,
          cover_status: "done",
          cover_attempts: (v.cover_attempts ?? 0) + 1,
          cover_last_error: null,
          cover_generated_at: new Date().toISOString(),
          cover_style_variant: acceptedVariant.id,
          cover_phash: acceptedHash,
          cover_subject_kind: acceptedVariant.kind,
          cover_subject_gender: acceptedVariant.gender,
        })
        .eq("id", v.id);
      succeeded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const nextAttempts = (v.cover_attempts ?? 0) + 1;
      await admin
        .from("vendors")
        .update({
          cover_status: "failed",
          cover_attempts: nextAttempts,
          cover_last_error: msg.slice(0, 500),
        })
        .eq("id", v.id);
      failed++;
      console.error(`vendor ${v.id} (${v.name}) failed: ${msg}`);
    }
    await admin
      .from("cover_jobs")
      .update({ processed: succeeded + failed, succeeded, failed })
      .eq("id", jobId);
  }

  await admin
    .from("cover_jobs")
    .update({
      status: "completed",
      processed: succeeded + failed,
      succeeded, failed,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const { count: remaining } = await admin
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .or(
      `cover_status.eq.pending,and(cover_status.eq.failed,cover_attempts.lt.${MAX_ATTEMPTS})`,
    );

  // ---- Post-batch QA: detect dup-rate spike & per-category diversity gaps ----
  const qa: {
    duplicate_rate: number;
    skewed_categories: { category: string; missing_buckets: string[] }[];
    auto_rerun_vendor_ids: string[];
    auto_rerun_triggered: boolean;
  } = {
    duplicate_rate: succeeded > 0 ? dupRejections / succeeded : 0,
    skewed_categories: [],
    auto_rerun_vendor_ids: [],
    auto_rerun_triggered: false,
  };

  if (!isAutoRerun && succeeded > 0) {
    const touchedCategories = Array.from(
      new Set((vendors ?? []).map((v: { category: string }) => v.category)),
    );

    const rerunIds = new Set<string>();

    // (1) High duplicate rate → re-roll the worst offenders we just produced.
    if (qa.duplicate_rate >= AUTO_RERUN_DUP_RATE) {
      for (const cat of touchedCategories) {
        const { data: rows } = await admin
          .from("vendors")
          .select("id,cover_phash,cover_generated_at")
          .eq("category", cat)
          .not("cover_phash", "is", null);
        if (!rows || rows.length < 2) continue;
        for (let i = 0; i < rows.length; i++) {
          for (let j = i + 1; j < rows.length; j++) {
            const d = hammingHex(rows[i].cover_phash as string, rows[j].cover_phash as string);
            if (d <= HAMMING_DUP_THRESHOLD) {
              // Re-roll the newer of the two (preserve the older established cover).
              const newer = (rows[i].cover_generated_at ?? "") >
                (rows[j].cover_generated_at ?? "") ? rows[i] : rows[j];
              rerunIds.add(newer.id as string);
            }
          }
        }
      }
    }

    // (2) Diversity skew per touched category.
    for (const cat of touchedCategories) {
      const allowed = variantsAllowedFor(cat);
      const allowedBuckets = Array.from(
        new Set(allowed.map((v) => `${v.kind}|${v.gender}`)),
      );
      if (allowedBuckets.length < 2) continue;

      const { data: rows } = await admin
        .from("vendors")
        .select("id,cover_subject_kind,cover_subject_gender,cover_generated_at")
        .eq("category", cat)
        .not("cover_subject_kind", "is", null);
      if (!rows || rows.length < AUTO_RERUN_MIN_CATEGORY) continue;

      const counts = new Map<string, { ids: string[] }>();
      for (const r of rows as Array<Record<string, unknown>>) {
        const k = `${r.cover_subject_kind}|${r.cover_subject_gender}`;
        if (!counts.has(k)) counts.set(k, { ids: [] });
        counts.get(k)!.ids.push(r.id);
      }
      const total = rows.length;
      const missing: string[] = [];
      for (const b of allowedBuckets) {
        const share = (counts.get(b)?.ids.length ?? 0) / total;
        if (share < AUTO_RERUN_BUCKET_MIN_SHARE) missing.push(b);
      }
      if (missing.length === 0) continue;

      qa.skewed_categories.push({ category: cat, missing_buckets: missing });

      // Pick vendors from the over-represented bucket(s), newest first.
      const overBuckets = Array.from(counts.entries())
        .sort((a, b) => b[1].ids.length - a[1].ids.length);
      const sortedRows = (rows as Array<Record<string, number>>).slice().sort((a, b) =>
        (b.cover_generated_at ?? "").localeCompare(a.cover_generated_at ?? ""),
      );
      let take = Math.min(missing.length * 2, 4);
      for (const r of sortedRows) {
        if (take <= 0) break;
        const k = `${r.cover_subject_kind}|${r.cover_subject_gender}`;
        if (k === overBuckets[0][0]) {
          rerunIds.add(r.id);
          take--;
        }
      }
    }

    qa.auto_rerun_vendor_ids = Array.from(rerunIds).slice(0, AUTO_RERUN_MAX_VENDORS);

    if (qa.auto_rerun_vendor_ids.length > 0) {
      // Reset selected vendors so the function will pick them.
      await admin
        .from("vendors")
        .update({ cover_status: "pending", cover_attempts: 0, cover_last_error: null })
        .in("id", qa.auto_rerun_vendor_ids);

      // Fire-and-forget self-invocation with auto_rerun=true to prevent recursion.
      try {
        const url = `${SUPABASE_URL}/functions/v1/generate-vendor-covers`;
        // Don't await — let it run while we return the primary response.
        fetch(url, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auto_rerun: true,
            batch_size: qa.auto_rerun_vendor_ids.length,
            vendor_ids: qa.auto_rerun_vendor_ids,
          }),
        }).catch((e) => console.error(`auto-rerun invoke failed: ${e}`));
        qa.auto_rerun_triggered = true;
        console.log(
          `auto-rerun: queued ${qa.auto_rerun_vendor_ids.length} vendors ` +
          `(dup_rate=${qa.duplicate_rate.toFixed(2)}, skewed=${qa.skewed_categories.length})`,
        );
      } catch (e) {
        console.error(`auto-rerun setup failed: ${e}`);
      }
    }
  }

  return new Response(
    JSON.stringify({
      job_id: jobId,
      processed: succeeded + failed,
      succeeded, failed,
      duplicate_rerolls: dupRejections,
      remaining: remaining ?? 0,
      qa,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
