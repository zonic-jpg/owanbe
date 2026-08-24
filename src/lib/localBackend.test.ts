import { describe, expect, it } from "vitest";
import { handleLocalRequest } from "./localBackend";

describe("localBackend auth", () => {
  it("rejects wrong password with a credential error, not Failed to fetch", async () => {
    const res = handleLocalRequest("https://placeholder.invalid/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: "user@demo.local", password: "nope" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.msg || body.error_description)).toMatch(/invalid login/i);
  });

  it("signs in demo user", async () => {
    const res = handleLocalRequest("https://placeholder.invalid/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: "user@demo.local", password: "test1111" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe("user@demo.local");
  });

  it("returns brand analytics rows", async () => {
    const res = handleLocalRequest(
      "https://placeholder.invalid/rest/v1/vendor_analytics_events?select=vendor_id,event_type,created_at&limit=10",
      { method: "GET" },
    );
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
});
