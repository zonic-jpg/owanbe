export const BRAND_PLANS = {
  monthly: { id: "monthly" as const, label: "Monthly", price: 100_000, period: "per month", periodDays: 30, badge: null },
  annual:  { id: "annual"  as const, label: "Annual",  price: 1_000_000, period: "per year", periodDays: 365, badge: "Save ₦200,000" },
};
export type BrandPlanId = keyof typeof BRAND_PLANS;
