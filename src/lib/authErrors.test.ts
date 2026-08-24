import { describe, expect, it } from "vitest";
import { looksLikeFetchFailure, resolveSupabaseEnv, describeUnreachableSupabase } from "./supabaseEnv";
import { mapAuthError } from "./authErrors";

describe("resolveSupabaseEnv", () => {
  it("accepts VITE_SUPABASE_PUBLISHABLE_KEY", () => {
    const s = resolveSupabaseEnv({
      VITE_SUPABASE_URL: "https://abc.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "eyJtest",
    });
    expect(s.configured).toBe(true);
    expect(s.anonKey).toBe("eyJtest");
  });

  it("falls back to VITE_SUPABASE_ANON_KEY (Railway/AWS docs name)", () => {
    const s = resolveSupabaseEnv({
      VITE_SUPABASE_URL: "https://abc.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-from-docs",
    });
    expect(s.configured).toBe(true);
    expect(s.anonKey).toBe("anon-from-docs");
  });

  it("strips quotes from .env values", () => {
    const s = resolveSupabaseEnv({
      VITE_SUPABASE_URL: '"https://abc.supabase.co"',
      VITE_SUPABASE_PUBLISHABLE_KEY: '"key"',
    });
    expect(s.url).toBe("https://abc.supabase.co");
    expect(s.anonKey).toBe("key");
  });

  it("flags missing and placeholder config", () => {
    expect(resolveSupabaseEnv({}).configured).toBe(false);
    expect(resolveSupabaseEnv({
      VITE_SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
      VITE_SUPABASE_ANON_KEY: "your-anon-key",
    }).configured).toBe(false);
  });
});

describe("mapAuthError", () => {
  const goodEnv = {
    VITE_SUPABASE_URL: "https://kpfzdvzjokdqaqrafffn.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
  };

  it("never shows raw Failed to fetch", () => {
    const mapped = mapAuthError(new TypeError("Failed to fetch"), goodEnv, "https:");
    expect(mapped.form).toBeTruthy();
    expect(mapped.form).not.toMatch(/Failed to fetch/i);
    expect(mapped.form).toMatch(/kpfzdvzjokdqaqrafffn\.supabase\.co|network|paused/i);
  });

  it("maps AuthRetryableFetchError the same way", () => {
    const err = Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError" });
    const mapped = mapAuthError(err, goodEnv, "https:");
    expect(mapped.form).not.toMatch(/Failed to fetch/i);
  });

  it("explains mixed content", () => {
    const mapped = mapAuthError(
      new TypeError("Failed to fetch"),
      { VITE_SUPABASE_URL: "http://kpfzdvzjokdqaqrafffn.supabase.co", VITE_SUPABASE_ANON_KEY: "key" },
      "https:",
    );
    expect(mapped.form).toMatch(/mixed content/i);
  });

  it("explains missing env instead of fetching", () => {
    const mapped = mapAuthError(new TypeError("Failed to fetch"), {}, "https:");
    expect(mapped.form).toMatch(/VITE_SUPABASE_URL/i);
  });

  it("keeps wrong-password as a credential error", () => {
    const mapped = mapAuthError({ message: "Invalid login credentials", code: "invalid_credentials" }, goodEnv);
    expect(mapped.fields.password).toMatch(/incorrect/i);
    expect(mapped.form).not.toMatch(/network|paused/i);
  });
});

describe("looksLikeFetchFailure", () => {
  it("detects browser and supabase-js fetch failures", () => {
    expect(looksLikeFetchFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(looksLikeFetchFailure({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe(true);
    expect(looksLikeFetchFailure({ message: "Invalid login credentials" })).toBe(false);
  });
});

describe("describeUnreachableSupabase", () => {
  it("names the host", () => {
    const env = resolveSupabaseEnv({
      VITE_SUPABASE_URL: "https://kpfzdvzjokdqaqrafffn.supabase.co",
      VITE_SUPABASE_ANON_KEY: "k",
    });
    const text = describeUnreachableSupabase({ env, error: new TypeError("Failed to fetch") });
    expect(text).toContain("kpfzdvzjokdqaqrafffn.supabase.co");
    expect(text).not.toMatch(/Failed to fetch/i);
  });
});
