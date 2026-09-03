import { afterEach, describe, expect, it } from "vitest";
import {
  GENERIC_ERROR,
  SIGN_IN_MESSAGE,
  isAuthMessage,
  isInternalMessage,
  publicError,
  publicMessage,
  setDiagnosticsAudience,
} from "./publicMessage";

afterEach(() => setDiagnosticsAudience(false));

describe("isInternalMessage", () => {
  it("flags infrastructure and driver detail", () => {
    for (const raw of [
      "Missing VITE_SUPABASE_URL",
      "Could not find the table 'public.vendors' in the schema cache",
      'PGRST205: relation "vendors" does not exist',
      "Failed to invoke edge function zonicme-payment",
      "Supabase project is paused",
      "insert into guests failed: duplicate key value",
      "Loaded from mocked seed data",
      "TODO: wire up real payments",
      "at loadVendors (Vendors.tsx:112:9)",
      '{"code":"42P01","message":"boom"}',
    ]) {
      expect(isInternalMessage(raw), raw).toBe(true);
    }
  });

  it("leaves ordinary copy and self-correctable input errors alone", () => {
    for (const raw of [
      "Guest name is required",
      "That email address doesn't look right",
      "Your password must be at least 8 characters",
      "No vendors match these filters yet",
      "The girls' table is full",
      "Smocked aso ebi is out of stock",
    ]) {
      expect(isInternalMessage(raw), raw).toBe(false);
    }
  });
});

// This is the gap that leaked "Unauthorized" to visitors in the sibling app:
// the word list covered infrastructure vocabulary but not auth vocabulary.
describe("auth and permission failures", () => {
  it("recognises the raw text Supabase and PostgREST return", () => {
    for (const raw of [
      "Unauthorized",
      "JWT expired",
      "permission denied for table guests",
      'new row violates row-level security policy for table "guests"',
      "Auth session missing!",
      "Admin sign-in required to read the approval queue",
      "Invalid API key",
    ]) {
      expect(isAuthMessage(raw), raw).toBe(true);
    }
  });

  it("maps them to a sign-in prompt rather than the generic error", () => {
    expect(publicMessage("Unauthorized")).toBe(SIGN_IN_MESSAGE);
    expect(publicError("JWT expired")).toBe(SIGN_IN_MESSAGE);
    expect(publicError({ message: "permission denied for table guests" })).toBe(SIGN_IN_MESSAGE);
  });

  it("does not mistake a wrong password for a permission failure", () => {
    expect(isAuthMessage("Invalid login credentials")).toBe(false);
    expect(publicMessage("Invalid login credentials")).toBe("Invalid login credentials");
  });
});

describe("publicMessage", () => {
  it("swaps internal text for the caller's fallback", () => {
    expect(publicMessage("relation \"vendors\" does not exist")).toBe(GENERIC_ERROR);
    expect(publicMessage("PGRST205", { fallback: "We couldn't load vendors." })).toBe(
      "We couldn't load vendors.",
    );
  });

  it("reads Error objects as well as strings", () => {
    expect(publicMessage(new Error("Missing VITE_SUPABASE_ANON_KEY"))).toBe(GENERIC_ERROR);
  });

  it("returns empty for nothing, so callers can skip silent toasts", () => {
    expect(publicMessage(null)).toBe("");
    expect(publicMessage("   ")).toBe("");
  });

  it("always returns something usable from publicError", () => {
    expect(publicError(null, "Fallback copy")).toBe("Fallback copy");
    expect(publicError(undefined)).toBe(GENERIC_ERROR);
  });

  it("keeps the real diagnosis for admins, who can act on it", () => {
    setDiagnosticsAudience(true);
    expect(publicMessage("Missing VITE_SUPABASE_URL")).toBe("Missing VITE_SUPABASE_URL");
    expect(publicError("Unauthorized")).toBe("Unauthorized");
  });

  it("still sanitises admin-visible text on public surfaces when forced", () => {
    setDiagnosticsAudience(true);
    expect(publicMessage("Missing VITE_SUPABASE_URL", { force: true })).toBe(GENERIC_ERROR);
  });
});
