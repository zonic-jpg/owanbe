/** Pure aso-ebi quote-comparison + distribution logic. */
export interface QuoteRow {
  id: string; provider_id: string; fabric: string | null;
  price_per_unit: number; min_order: number; delivery_days: number | null;
  status: string; notes: string | null;
}

/** Rank quotes: cheapest first; ties broken by faster delivery, then lower minimum. */
export function rankQuotes(quotes: QuoteRow[]): QuoteRow[] {
  return [...quotes].sort((a, b) =>
    a.price_per_unit - b.price_per_unit ||
    (a.delivery_days ?? 999) - (b.delivery_days ?? 999) ||
    a.min_order - b.min_order);
}

/** Savings of the best quote vs the average of all received quotes, per unit. */
export function bestQuoteSavings(quotes: QuoteRow[]): { best: QuoteRow | null; savingsPerUnit: number; vsAverage: number } {
  if (quotes.length === 0) return { best: null, savingsPerUnit: 0, vsAverage: 0 };
  const ranked = rankQuotes(quotes);
  const best = ranked[0];
  const avg = quotes.reduce((s, q) => s + q.price_per_unit, 0) / quotes.length;
  return { best, savingsPerUnit: Math.max(0, avg - best.price_per_unit), vsAverage: avg };
}

export interface GuestOrderRow { qty: number; amount: number; paid: boolean; collected: boolean }

/** Headline distribution stats: units ordered, money in, outstanding, collection progress. */
export function distributionStats(rows: GuestOrderRow[]) {
  const units = rows.reduce((s, r) => s + r.qty, 0);
  const expected = rows.reduce((s, r) => s + r.amount, 0);
  const paidAmt = rows.filter((r) => r.paid).reduce((s, r) => s + r.amount, 0);
  const collected = rows.filter((r) => r.collected).length;
  return {
    buyers: rows.length, units, expected,
    paid: paidAmt, outstanding: expected - paidAmt,
    defaulters: rows.filter((r) => !r.paid).length,
    collected,
  };
}

/** Prefilled WhatsApp RFQ message to a provider. */
export function rfqMessage(c: { title: string; fabric_type: string | null; colors: string | null; qty_estimate: number | null; budget_per_unit: number | null; deadline: string | null; requirements: string | null }, eventName: string): string {
  const parts = [
    `Hello! I'm sourcing aso-ebi for ${eventName}.`,
    c.fabric_type ? `Fabric: ${c.fabric_type}` : "",
    c.colors ? `Colours: ${c.colors}` : "",
    c.qty_estimate ? `Quantity: about ${c.qty_estimate} units` : "",
    c.budget_per_unit ? `Budget: around NGN ${Number(c.budget_per_unit).toLocaleString()} per unit` : "",
    c.deadline ? `Needed by: ${c.deadline}` : "",
    c.requirements ? `Details: ${c.requirements}` : "",
    "Please send your best price per unit, minimum order, and delivery time. Thank you!",
  ];
  return parts.filter(Boolean).join("\n");
}
