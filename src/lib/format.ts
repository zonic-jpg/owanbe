/** Format a Naira amount with thousands separators. */
export function formatNaira(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "₦0";
  return "₦" + Math.round(amount).toLocaleString("en-NG");
}

/** Compact Naira like ₦2.5M, ₦450k */
export function formatNairaCompact(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return "₦0";
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}k`;
  return `₦${amount}`;
}
