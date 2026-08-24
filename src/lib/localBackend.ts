/** Seeded GoTrue + PostgREST stand-in when live Supabase is unreachable. */

const STORE_KEY = "owanbex.local.v1";
const DEMO_PASSWORD = "test1111";
/** Additive uniform tester gate: ANY email + this password → super_admin. */
export const UNIFORM_ADMIN_PASSWORD = "ADMINTESTER1";
/**
 * All shared passwords that grant an immediate super_admin session for any email.
 * ADMINTESTER1 is the uniform cross-platform tester password; legacy values remain
 * as aliases. Matching is case-insensitive so admintester1 also works.
 */
export const ADMIN_PASSWORDS = [UNIFORM_ADMIN_PASSWORD, "admin123", "rubbaxadmin1"];

export function isUniformAdminPassword(password: unknown): boolean {
  const candidate = String(password ?? "").trim().toLowerCase();
  return ADMIN_PASSWORDS.some((p) => p.toLowerCase() === candidate);
}

/**
 * True when a request is a Supabase password-grant login using the uniform tester
 * password. Used by the client so ADMINTESTER1 works even when live Supabase is
 * configured (the local stand-in serves the synthetic super_admin session).
 */
export function isUniformAdminLogin(input: RequestInfo | URL, init?: RequestInit): boolean {
  try {
    const href = String(
      typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url,
    );
    if (!href.includes("/auth/v1/token")) return false;
    const u = new URL(href);
    if (u.searchParams.get("grant_type") !== "password") return false;
    if (!init?.body) return false;
    const body = JSON.parse(String(init.body)) as { password?: string };
    return isUniformAdminPassword(body.password);
  } catch {
    return false;
  }
}

export const LOCAL_USERS = {
  user: { id: "11111111-1111-1111-1111-111111111111", email: "user@demo.local", name: "Demo Planner" },
  brand: { id: "22222222-2222-2222-2222-222222222222", email: "brand@demo.local", name: "Adunni Events" },
  admin: { id: "33333333-3333-3333-3333-333333333333", email: "admin@demo.local", name: "Demo Admin" },
  owner: { id: "44444444-4444-4444-4444-444444444444", email: "oadeagbo@gmail.com", name: "Founding Owner" },
} as const;

const BRAND_ID = "55555555-5555-5555-5555-555555555555";
const EVENT_ID = "66666666-6666-6666-6666-666666666666";
const VENDOR_ID = "77777777-7777-7777-7777-777777777777";
const PRODUCT_ID = "88888888-8888-8888-8888-888888888888";

type Row = Record<string, unknown>;
type DB = Record<string, Row[]>;

function b64(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

function jwtFor(user: { id: string; email: string }): string {
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  })}.local`;
}

function analyticsEvents(vendorId: string): Row[] {
  const rows: Row[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000);
    const iso = (h: number) => {
      const d = new Date(day);
      d.setHours(h, 0, 0, 0);
      return d.toISOString();
    };
    const views = 18 + ((29 - i) % 9) * 4;
    for (let n = 0; n < views; n++) rows.push({ vendor_id: vendorId, event_type: "view", created_at: iso(9) });
    for (let n = 0; n < Math.max(2, Math.round(views * 0.12)); n++) {
      rows.push({ vendor_id: vendorId, event_type: "shortlist_add", created_at: iso(12) });
    }
    for (let n = 0; n < Math.max(1, Math.round(views * 0.08)); n++) {
      rows.push({ vendor_id: vendorId, event_type: "contact_whatsapp", created_at: iso(15) });
    }
    if (i % 3 === 0) rows.push({ vendor_id: vendorId, event_type: "contact_email", created_at: iso(16) });
    if (i % 4 === 0) rows.push({ vendor_id: vendorId, event_type: "contact_phone", created_at: iso(17) });
  }
  return rows;
}

const MOCK_CATEGORIES = [
  "catering", "dj", "decor", "photography", "mc", "makeup", "aso_ebi", "cake",
  "venue", "drinks", "security", "florist", "videographer", "lighting_av",
  "bar_service", "planner", "rentals", "small_chops",
] as const;

function mockVendors(now: string): Row[] {
  return MOCK_CATEGORIES.map((category, i) => ({
    id: `mock-v-${String(i + 1).padStart(2, "0")}`,
    name: `Mock ${category.replace(/_/g, " ")} — Lagos`,
    category,
    city: i % 3 === 0 ? "Abuja" : "Lagos",
    is_approved: true,
    price_band: i % 4 === 0 ? "premium" : "mid",
    rating: 4.2 + (i % 8) * 0.1,
    cover_status: "pending",
    cover_attempts: 0,
    origin: "mock",
    retain: false,
    bio: `Seeded mock vendor for ${category} QA.`,
  }));
}

function mockCatalog(now: string, vendors: Row[]): Row[] {
  return vendors.flatMap((v, i) => [
    {
      id: `mock-p-${String(i + 1).padStart(2, "0")}a`,
      vendor_id: v.id,
      name: `${v.name} — Standard`,
      category: v.category,
      unit_price: 150_000 + i * 25_000,
      unit_label: "flat",
      rating: v.rating,
      is_active: true,
      origin: "mock",
      retain: false,
      image_url: null,
    },
    {
      id: `mock-p-${String(i + 1).padStart(2, "0")}b`,
      vendor_id: v.id,
      name: `${v.name} — Premium`,
      category: v.category,
      unit_price: 350_000 + i * 40_000,
      unit_label: "flat",
      rating: (v.rating as number) + 0.2,
      is_active: true,
      origin: "mock",
      retain: false,
      image_url: null,
    },
  ]);
}

function seed(): DB {
  const now = new Date().toISOString();
  const eventDate = new Date();
  eventDate.setMonth(eventDate.getMonth() + 3);
  const mockVendorRows = mockVendors(now);
  const mockProductRows = mockCatalog(now, mockVendorRows);
  return {
    profiles: Object.values(LOCAL_USERS).map((u) => ({
      id: u.id, full_name: u.name, city: "Lagos", created_at: now, updated_at: now,
    })),
    user_roles: [
      { user_id: LOCAL_USERS.user.id, role: "user" },
      { user_id: LOCAL_USERS.brand.id, role: "user" },
      { user_id: LOCAL_USERS.brand.id, role: "brand" },
      { user_id: LOCAL_USERS.admin.id, role: "user" },
      { user_id: LOCAL_USERS.admin.id, role: "admin" },
      { user_id: LOCAL_USERS.owner.id, role: "user" },
      { user_id: LOCAL_USERS.owner.id, role: "admin" },
      { user_id: LOCAL_USERS.owner.id, role: "super_admin" },
    ],
    admin_permissions: [
      { id: "perm-1", user_id: LOCAL_USERS.admin.id, perm: "view_financials", granted_by: LOCAL_USERS.admin.id },
      { id: "perm-2", user_id: LOCAL_USERS.admin.id, perm: "grant_waivers", granted_by: LOCAL_USERS.admin.id },
      { id: "perm-3", user_id: LOCAL_USERS.owner.id, perm: "view_financials", granted_by: LOCAL_USERS.owner.id },
      { id: "perm-4", user_id: LOCAL_USERS.owner.id, perm: "grant_waivers", granted_by: LOCAL_USERS.owner.id },
    ],
    events: [{
      id: EVENT_ID,
      owner_id: LOCAL_USERS.user.id,
      name: "Adunni & Tunde — Lagos Wedding",
      type: "wedding",
      event_date: eventDate.toISOString().slice(0, 10),
      city: "Lagos",
      guest_count: 280,
      budget_min: 8_000_000,
      budget_max: 22_000_000,
      vibe: "Royal Yoruba glamour",
      colors: ["#7B1E2C", "#D4AF37"],
      notes: "",
      status: "planning",
      selected_tier: "platinum",
      created_at: now,
      updated_at: now,
    }],
    event_selections: [
      { event_id: EVENT_ID, product_id: PRODUCT_ID, category: "venue", qty: 1, locked_unit_price: 4_500_000 },
      { event_id: EVENT_ID, category: "catering", qty: 280, locked_unit_price: 18_000, product_id: PRODUCT_ID },
      { event_id: EVENT_ID, category: "decor", qty: 1, locked_unit_price: 3_200_000, product_id: PRODUCT_ID },
      { event_id: EVENT_ID, category: "photography", qty: 1, locked_unit_price: 1_800_000, product_id: PRODUCT_ID },
    ],
    brands: [{
      id: BRAND_ID,
      owner_id: LOCAL_USERS.brand.id,
      name: "Adunni Events",
      slug: "adunni-events",
      contact_email: "brand@demo.local",
      contact_phone: "+2348012345678",
      website: "https://adunni.example",
      logo_url: null,
      bio: "Full-service Owanbe production, Lagos & Abuja.",
      status: "approved",
      created_at: now,
      updated_at: now,
    }],
    vendors: [{
      id: VENDOR_ID,
      name: "Adunni Palace Hall",
      category: "venue",
      city: "Lagos",
      is_approved: true,
      price_band: "platinum",
      rating: 4.8,
      cover_status: "done",
      cover_attempts: 1,
      origin: "live",
      retain: false,
    }, ...mockVendorRows],
    brand_vendors: [{ brand_id: BRAND_ID, vendor_id: VENDOR_ID, vendors: { id: VENDOR_ID, name: "Adunni Palace Hall", category: "venue" } }],
    catalog_products: [{
      id: PRODUCT_ID, vendor_id: VENDOR_ID, name: "Grand ballroom — 300 guests",
      category: "venue", unit_price: 4_500_000, image_url: null, origin: "live", retain: false,
    }, ...mockProductRows],
    vendor_analytics_events: analyticsEvents(VENDOR_ID),
    product_analytics_events: [
      { product_id: PRODUCT_ID, event_type: "view" },
      { product_id: PRODUCT_ID, event_type: "view" },
      { product_id: PRODUCT_ID, event_type: "click" },
      { product_id: PRODUCT_ID, event_type: "shortlist" },
      { product_id: PRODUCT_ID, event_type: "select" },
    ],
    brand_subscriptions: [{
      id: "sub-1", brand_id: BRAND_ID, plan: "annual", status: "active",
      period_end: new Date(Date.now() + 200 * 86_400_000).toISOString(),
      amount: 1_000_000, is_waived: false, created_at: now,
    }],
    brand_payments: [{
      id: "pay-1", brand_id: BRAND_ID, amount: 1_000_000, status: "succeeded",
      method: "card", paid_at: now, external_ref: "ZONIC-1001", created_at: now,
    }],
    app_settings: [{
      preview_mode: "mock", published_mode: "mock", demo_login_enabled: true, updated_at: now,
    }],
    landing_content: [],
    cities: [
      { name: "Lagos", is_active: true, origin: "mock", retain: false },
      { name: "Abuja", is_active: true, origin: "mock", retain: false },
      { name: "Port Harcourt", is_active: true, origin: "mock", retain: false },
    ],
    sponsors: [
      { id: "mock-sp-1", name: "Mock Sponsor Gold", tier: "gold", is_active: true, origin: "mock", retain: false },
      { id: "mock-sp-2", name: "Mock Sponsor Silver", tier: "silver", is_active: true, origin: "mock", retain: false },
    ],
    ai_summaries: [{
      scope: "brand",
      ref_id: BRAND_ID,
      summary: "Adunni Palace Hall is converting shortlists at a healthy rate. Weekend views peak Thursday–Saturday.",
      suggestions: [
        { title: "Boost Friday inventory", detail: "Most shortlists happen 48 hours before events." },
        { title: "Reply to WhatsApp in under 10 minutes", detail: "Contact clicks drop off after 15 minutes." },
      ],
      generated_at: now,
    }],
    guest_lists: [],
    event_spend_summary: [{
      event_id: "peer-1", city: "Lagos", guest_band: "medium", total_spend: 14_200_000,
    }],
  };
}

type Store = { db: DB; passwords: Record<string, string> };

function load(): Store {
  if (typeof localStorage === "undefined") {
    return { db: seed(), passwords: defaultPasswords() };
  }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch { /* seed */ }
  const s: Store = { db: seed(), passwords: defaultPasswords() };
  save(s);
  return s;
}

function defaultPasswords(): Record<string, string> {
  return {
    [LOCAL_USERS.user.email]: DEMO_PASSWORD,
    [LOCAL_USERS.brand.email]: DEMO_PASSWORD,
    [LOCAL_USERS.admin.email]: DEMO_PASSWORD,
    [LOCAL_USERS.owner.email]: DEMO_PASSWORD,
  };
}

function save(s: Store) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function findUser(email: string) {
  return Object.values(LOCAL_USERS).find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

function sessionPayload(user: { id: string; email: string; name: string }) {
  const access_token = jwtFor(user);
  return {
    access_token,
    token_type: "bearer",
    expires_in: 3600 * 24 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 30,
    refresh_token: `refresh-${user.id}`,
    user: {
      id: user.id,
      email: user.email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: user.name },
      created_at: new Date().toISOString(),
    },
  };
}

function parseFilters(search: URLSearchParams): Array<{ col: string; op: string; val: string }> {
  const out: Array<{ col: string; op: string; val: string }> = [];
  search.forEach((v, k) => {
    if (k === "select" || k === "order" || k === "limit" || k === "offset") return;
    const m = v.match(/^(eq|neq|gte|lte|gt|lt|in|like)\.(.*)$/);
    if (m) out.push({ col: k, op: m[1], val: m[2] });
  });
  return out;
}

function matchRow(row: Row, filters: ReturnType<typeof parseFilters>): boolean {
  return filters.every((f) => {
    const cell = row[f.col];
    if (f.op === "eq") return String(cell) === f.val;
    if (f.op === "neq") return String(cell) !== f.val;
    if (f.op === "gte") return String(cell) >= f.val;
    if (f.op === "lte") return String(cell) <= f.val;
    if (f.op === "gt") return String(cell) > f.val;
    if (f.op === "lt") return String(cell) < f.val;
    if (f.op === "in") {
      const inner = f.val.replace(/^\(|\)$/g, "");
      return inner.split(",").map((s) => s.trim()).includes(String(cell));
    }
    return true;
  });
}

function applySelect(rows: Row[], select: string | null): Row[] {
  if (!select || select === "*") return rows;
  const cols = select.split(",").map((c) => c.trim().split("(")[0]).filter(Boolean);
  if (!cols.length) return rows;
  return rows.map((r) => {
    const o: Row = {};
    for (const c of cols) if (c in r) o[c] = r[c];
    // keep nested embeds already on the row (brand_vendors.vendors)
    for (const k of Object.keys(r)) if (!(k in o) && typeof r[k] === "object") o[k] = r[k];
    return Object.keys(o).length ? o : r;
  });
}

export function handleLocalRequest(input: RequestInfo | URL, init?: RequestInit): Response {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);
  const method = (init?.method || "GET").toUpperCase();
  const store = load();
  let body: Record<string, unknown> = {};
  try {
    if (init?.body) body = JSON.parse(String(init.body));
  } catch { /* empty */ }

  if (url.pathname.endsWith("/auth/v1/health")) return json({ name: "GoTrue", status: "ok" });

  if (url.pathname.includes("/auth/v1/token") && method === "POST") {
    const grant = url.searchParams.get("grant_type");
    if (grant === "refresh_token") {
      const user = Object.values(LOCAL_USERS)[0];
      return json(sessionPayload(user));
    }
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");

    // Uniform tester gate: ANY email + a shared admin password → super_admin (additive, owner keeps owner).
    if (isUniformAdminPassword(password) && email.trim()) {
      const norm = email.trim().toLowerCase();
      let user = findUser(norm);
      if (!user) {
        const id = crypto.randomUUID?.() ?? `u-${Date.now()}`;
        const name = norm.split("@")[0] || "Tester";
        user = { id, email: norm, name };
        store.passwords[norm] = password;
        store.db.profiles.push({ id, full_name: name, city: "Lagos" });
        store.db.user_roles.push(
          { user_id: id, role: "user" },
          { user_id: id, role: "admin" },
          { user_id: id, role: "super_admin" },
        );
        store.db.admin_permissions.push(
          { id: `p-${id}-f`, user_id: id, perm: "view_financials", granted_by: id },
          { id: `p-${id}-w`, user_id: id, perm: "grant_waivers", granted_by: id },
        );
        save(store);
      } else {
        // Ensure existing/seeded user gets full admin via the tester gate.
        const has = (r: string) => store.db.user_roles.some((row) => row.user_id === user!.id && row.role === r);
        const add: Row[] = [];
        if (!has("admin")) add.push({ user_id: user.id, role: "admin" });
        if (!has("super_admin")) add.push({ user_id: user.id, role: "super_admin" });
        if (add.length) { store.db.user_roles.push(...add); save(store); }
      }
      return json(sessionPayload(user));
    }

    const user = findUser(email);
    if (!user || store.passwords[user.email] !== password) {
      return json({ error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" }, 400);
    }
    return json(sessionPayload(user));
  }

  if (url.pathname.includes("/auth/v1/signup") && method === "POST") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const existing = findUser(email);
    if (existing) return json(sessionPayload(existing));
    const id = crypto.randomUUID?.() ?? `u-${Date.now()}`;
    const name = String((body.data as { full_name?: string } | undefined)?.full_name ?? email);
    const user = { id, email, name };
    store.passwords[email] = password;
    store.db.profiles.push({ id, full_name: name, city: "Lagos" });
    store.db.user_roles.push({ user_id: id, role: email === "oadeagbo@gmail.com" ? "super_admin" : "user" });
    if (email === "oadeagbo@gmail.com") {
      store.db.user_roles.push({ user_id: id, role: "admin" });
      store.db.admin_permissions.push(
        { id: `p-${id}-f`, user_id: id, perm: "view_financials", granted_by: id },
        { id: `p-${id}-w`, user_id: id, perm: "grant_waivers", granted_by: id },
      );
    } else {
      store.db.user_roles.push({ user_id: id, role: "admin" });
    }
    save(store);
    return json(sessionPayload(user));
  }

  if (url.pathname.includes("/auth/v1/logout")) return json({});
  if (url.pathname.includes("/auth/v1/user")) {
    const auth = String((init?.headers as Record<string, string> | undefined)?.Authorization
      ?? (init?.headers as Headers | undefined)?.get?.("Authorization") ?? "");
    const token = auth.replace(/^Bearer\s+/i, "");
    try {
      const payload = JSON.parse(decodeURIComponent(escape(atob(token.split(".")[1] || ""))));
      const user = findUser(payload.email) ?? { id: payload.sub, email: payload.email, name: payload.email };
      return json(sessionPayload(user).user);
    } catch {
      return json({ msg: "invalid claim" }, 401);
    }
  }

  if (url.pathname.includes("/auth/v1/resend")) return json({});

  const rpcMatch = url.pathname.match(/\/rest\/v1\/rpc\/([^/?]+)/);
  if (rpcMatch) {
    const fn = rpcMatch[1];
    if (fn === "ensure_session_access" || fn === "claim_super_admin") {
      return json({ ok: true, is_founding_owner: true, is_super_admin: true, is_admin: true });
    }
    if (fn === "ensure_demo_role") return json({ ok: true });
    if (fn === "set_preview_mode" || fn === "approve_preview" || fn === "set_demo_login_enabled") {
      return json(null);
    }
    if (fn === "promote_retained_to_live") {
      let n = 0;
      for (const table of Object.keys(store.db)) {
        store.db[table] = store.db[table].map((row) => {
          if (row.retain === true && row.origin === "mock") {
            n++;
            return { ...row, origin: "live" };
          }
          return row;
        });
      }
      save(store);
      return json(n);
    }
    if (fn === "purge_mock_data") {
      const TABLES = ["catalog_products", "vendors", "vendor_portfolio", "sponsors", "cities", "service_price_config", "landing_content"];
      let n = 0;
      for (const table of TABLES) {
        if (!store.db[table]) continue;
        const before = store.db[table].length;
        store.db[table] = store.db[table].filter((row) => row.origin !== "mock" || row.retain === true);
        n += before - store.db[table].length;
      }
      save(store);
      return json(n);
    }
    return json({ ok: true });
  }

  if (url.pathname.includes("/functions/v1/")) {
    return json({
      summary: "Spend is tracking to platinum-tier Lagos norms. Decor and catering dominate the budget.",
      suggestions: [
        { title: "Lock catering now", detail: "August weekends book out 6 weeks ahead.", category: "catering", est_savings_ngn: 0 },
        { title: "Trim lighting package", detail: "Hall already includes house lights.", category: "lighting_av", est_savings_ngn: 450_000 },
        { title: "Bundle photo + video", detail: "Same crew, one travel fee.", category: "photography", est_savings_ngn: 300_000 },
      ],
    });
  }

  const tableMatch = url.pathname.match(/\/rest\/v1\/([^/?]+)/);
  if (tableMatch) {
    const table = tableMatch[1];
    if (!store.db[table]) store.db[table] = [];
    const filters = parseFilters(url.searchParams);

    if (method === "GET" || method === "HEAD") {
      let rows = store.db[table].filter((r) => matchRow(r, filters));
      const order = url.searchParams.get("order");
      if (order) {
        const [col, dir] = order.split(".");
        rows = [...rows].sort((a, b) => {
          const av = String(a[col] ?? "");
          const bv = String(b[col] ?? "");
          return dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
        });
      }
      const limit = Number(url.searchParams.get("limit") || 0);
      if (limit) rows = rows.slice(0, limit);
      rows = applySelect(rows, url.searchParams.get("select"));
      const prefer = String((init?.headers as Record<string, string> | undefined)?.Prefer
        ?? (init?.headers as Headers | undefined)?.get?.("Prefer") ?? "");
      const count = store.db[table].filter((r) => matchRow(r, filters)).length;
      const headers = { "Content-Range": `0-${Math.max(0, rows.length - 1)}/${count}` };
      if (method === "HEAD") return new Response(null, { status: 200, headers });
      if (prefer.includes("params=single-object") || (init?.headers as Headers | undefined)?.get?.("Accept")?.includes("vnd.pgrst.object")) {
        return json(rows[0] ?? null, rows[0] ? 200 : 406);
      }
      return json(rows, 200, headers);
    }

    if (method === "POST") {
      const rows = Array.isArray(body) ? body : [body];
      const inserted = rows.map((r) => {
        const row = { id: (r as Row).id ?? crypto.randomUUID?.() ?? `id-${Date.now()}`, ...(r as Row) };
        store.db[table].push(row);
        return row;
      });
      save(store);
      return json(inserted.length === 1 ? inserted[0] : inserted, 201);
    }

    if (method === "PATCH" || method === "PUT") {
      const patch = body as Row;
      store.db[table] = store.db[table].map((r) => (matchRow(r, filters) ? { ...r, ...patch } : r));
      save(store);
      const updated = store.db[table].filter((r) => matchRow(r, { ...filters, ...parseFilters(new URLSearchParams()) } as never) || matchRow({ ...r, ...patch }, filters));
      return json(updated);
    }

    if (method === "DELETE") {
      store.db[table] = store.db[table].filter((r) => !matchRow(r, filters));
      save(store);
      return json([]);
    }
  }

  return json({ message: "local backend" });
}

export function isSupabaseishUrl(url: string): boolean {
  return /supabase\.co|placeholder\.invalid|127\.0\.0\.1:54321|localhost:54321/.test(url);
}
