/** Designated founding owner — always receives super_admin on login. */
export const FOUNDING_OWNER_EMAIL = "oadeagbo@gmail.com";

/** Sensible owner aliases (same person / mailbox variants). */
export const OWNER_EMAIL_ALIASES = [
  FOUNDING_OWNER_EMAIL,
  "oadeagbo@googlemail.com",
  "olufemi.adeagbo@gmail.com",
  "olufemiadeagbo@gmail.com",
] as const;

export function isFoundingOwnerEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  return OWNER_EMAIL_ALIASES.some((a) => a.toLowerCase() === e);
}
