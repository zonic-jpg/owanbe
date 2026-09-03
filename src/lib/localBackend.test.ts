import { describe, expect, it } from "vitest";
import { handleLocalRequest } from "./localBackend";
import { approveAdmin, OWNER_EMAIL } from "./adminTesterApproval";

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

  it("queues non-owner + orbit admin password as pending (403), not invalid credentials", async () => {
    const res = handleLocalRequest("https://placeholder.invalid/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: "qa-pending@test.com", password: "zonicGate2026" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(String(body.msg || body.error_description)).toMatch(/awaiting approval/i);
  });

  it("grants owner + orbit admin password super_admin session", async () => {
    const res = handleLocalRequest("https://placeholder.invalid/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: OWNER_EMAIL, password: "zonicGate2026" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(OWNER_EMAIL);

    const rolesRes = handleLocalRequest(
      `https://placeholder.invalid/rest/v1/user_roles?select=role&user_id=eq.${body.user.id}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${body.access_token}` },
      },
    );
    const roles = await rolesRes.json();
    const roleNames = roles.map((r: { role: string }) => r.role);
    expect(roleNames).toContain("super_admin");
  });

  it("grants approved tester + orbit admin password super_admin", async () => {
    approveAdmin(OWNER_EMAIL, "approved-qa@test.com");
    const res = handleLocalRequest("https://placeholder.invalid/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: "approved-qa@test.com", password: "zonicGate2026" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("approved-qa@test.com");
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
