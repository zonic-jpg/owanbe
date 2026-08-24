import { describe, expect, it } from "vitest";
import { bestQuoteSavings, distributionStats, rankQuotes, rfqMessage, type QuoteRow } from "./aso-ebi";
import { gateBlocks } from "./service-gates";

const q = (o: Partial<QuoteRow>): QuoteRow => ({
  id: Math.random().toString(36), provider_id: "p", fabric: "lace",
  price_per_unit: 10000, min_order: 1, delivery_days: 5, status: "received", notes: null, ...o,
});

describe("rankQuotes", () => {
  it("cheapest first, ties by delivery then minimum order", () => {
    const ranked = rankQuotes([
      q({ id: "slow", price_per_unit: 9000, delivery_days: 10 }),
      q({ id: "fast", price_per_unit: 9000, delivery_days: 3 }),
      q({ id: "cheapest", price_per_unit: 8000 }),
      q({ id: "pricey", price_per_unit: 12000 }),
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["cheapest", "fast", "slow", "pricey"]);
  });
});

describe("bestQuoteSavings", () => {
  it("computes per-unit savings vs the average", () => {
    const { best, savingsPerUnit, vsAverage } = bestQuoteSavings([
      q({ price_per_unit: 8000 }), q({ price_per_unit: 10000 }), q({ price_per_unit: 12000 }),
    ]);
    expect(best?.price_per_unit).toBe(8000);
    expect(vsAverage).toBe(10000);
    expect(savingsPerUnit).toBe(2000);
  });
  it("empty quotes -> null best", () => {
    expect(bestQuoteSavings([]).best).toBeNull();
  });
});

describe("distributionStats", () => {
  it("tracks units, money in, outstanding, defaulters, collection", () => {
    const s = distributionStats([
      { qty: 2, amount: 30000, paid: true, collected: true },
      { qty: 1, amount: 15000, paid: true, collected: false },
      { qty: 1, amount: 15000, paid: false, collected: false },
    ]);
    expect(s.buyers).toBe(3);
    expect(s.units).toBe(4);
    expect(s.expected).toBe(60000);
    expect(s.paid).toBe(45000);
    expect(s.outstanding).toBe(15000);
    expect(s.defaulters).toBe(1);
    expect(s.collected).toBe(1);
  });
});

describe("rfqMessage", () => {
  it("includes every provided requirement and skips blanks", () => {
    const msg = rfqMessage({ title: "Aso-ebi", fabric_type: "Swiss lace", colors: "Emerald & gold", qty_estimate: 60, budget_per_unit: 15000, deadline: "2026-09-01", requirements: null }, "Ada & Emeka's wedding");
    expect(msg).toContain("Swiss lace");
    expect(msg).toContain("Emerald & gold");
    expect(msg).toContain("60 units");
    expect(msg).toContain("15,000");
    expect(msg).not.toContain("Details:");
  });
});

describe("gateBlocks (payment gate rules)", () => {
  const pay = (service: string, event_id: string | null): { service: string; event_id: string | null; status: string } => ({ service, event_id, status: "paid" });
  it("disabled or missing gate never blocks", () => {
    expect(gateBlocks(undefined, [], "guest_list")).toBe(false);
    expect(gateBlocks({ enabled: false, model: "one_off" }, [], "guest_list")).toBe(false);
  });
  it("one_off blocks until any payment exists", () => {
    expect(gateBlocks({ enabled: true, model: "one_off" }, [], "aso_ebi")).toBe(true);
    expect(gateBlocks({ enabled: true, model: "one_off" }, [pay("aso_ebi", null)], "aso_ebi")).toBe(false);
  });
  it("per_event requires payment for THAT event", () => {
    const g = { enabled: true, model: "per_event" as const };
    expect(gateBlocks(g, [pay("guest_list", "ev1")], "guest_list", "ev2")).toBe(true);
    expect(gateBlocks(g, [pay("guest_list", "ev2")], "guest_list", "ev2")).toBe(false);
  });
  it("payments for other services don't unlock", () => {
    expect(gateBlocks({ enabled: true, model: "one_off" }, [pay("ecommerce", null)], "aso_ebi")).toBe(true);
  });
});
