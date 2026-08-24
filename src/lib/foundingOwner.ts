/** Designated founding owner — always receives super_admin on login. */
export const FOUNDING_OWNER_EMAIL = "oadeagbo@gmail.com";

export function isFoundingOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === FOUNDING_OWNER_EMAIL;
}
