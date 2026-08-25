/** Per-service Free | Freemium | Paid — draft + activate (Owanbe). */
export type ServicePricingMode = "free" | "freemium" | "paid";

export type ServicePricingRow = {
  id: string;
  label: string;
  mode: ServicePricingMode;
  priceNgn: number;
  guestAllowance: number;
  active: boolean;
};

const ACTIVE_KEY = "owanbe_service_pricing_v1";
const DRAFT_KEY = "owanbe_service_pricing_draft_v1";

export const OWANBE_SERVICE_CATALOG: Omit<ServicePricingRow, "active">[] = [
  { id: "registration", label: "Guest registration", mode: "free", priceNgn: 0, guestAllowance: 0 },
  { id: "ecommerce", label: "Aso-ebi / shop", mode: "free", priceNgn: 0, guestAllowance: 0 },
  { id: "guest_list", label: "Guest list", mode: "free", priceNgn: 0, guestAllowance: 0 },
  { id: "aso_ebi", label: "Aso-ebi coordination", mode: "free", priceNgn: 0, guestAllowance: 0 },
  { id: "event_management", label: "Event management", mode: "free", priceNgn: 0, guestAllowance: 0 },
];

function read(key: string): Record<string, ServicePricingRow> {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
}

function write(key: string, all: Record<string, ServicePricingRow>) {
  localStorage.setItem(key, JSON.stringify(all));
}

function defaults(): Record<string, ServicePricingRow> {
  return Object.fromEntries(OWANBE_SERVICE_CATALOG.map((s) => [s.id, { ...s, active: true }]));
}

export function listActiveServicePricing(): ServicePricingRow[] {
  const base = defaults();
  const active = { ...base, ...read(ACTIVE_KEY) };
  return OWANBE_SERVICE_CATALOG.map((s) => ({ ...base[s.id], ...active[s.id], active: active[s.id]?.active !== false }));
}

export function getServiceDraft(id: string): ServicePricingRow {
  const active = listActiveServicePricing().find((s) => s.id === id);
  const draft = read(DRAFT_KEY)[id];
  return { ...(active || defaults()[id]), ...draft, id };
}

export function saveServiceDraft(id: string, patch: Partial<ServicePricingRow>): ServicePricingRow {
  const draft = read(DRAFT_KEY);
  const prev = getServiceDraft(id);
  draft[id] = { ...prev, ...patch, id, active: false };
  write(DRAFT_KEY, draft);
  return draft[id];
}

export function activateServicePricing(id: string): ServicePricingRow {
  const draft = read(DRAFT_KEY);
  const row = { ...getServiceDraft(id), ...(draft[id] || {}), active: true };
  const active = { ...defaults(), ...read(ACTIVE_KEY), [id]: row };
  write(ACTIVE_KEY, active);
  delete draft[id];
  write(DRAFT_KEY, draft);
  return row;
}

export function isServicePricingVisible(row: Pick<ServicePricingRow, "mode">): boolean {
  return row.mode !== "free";
}

/** Map pricing mode to legacy service_gates.enabled + price for Supabase sync. */
export function toGateFields(row: ServicePricingRow) {
  return {
    enabled: row.mode !== "free" && row.active,
    price: row.mode === "paid" ? row.priceNgn : row.mode === "freemium" ? 0 : 0,
    model: row.mode === "freemium" ? "per_event" : "one_off",
  };
}
