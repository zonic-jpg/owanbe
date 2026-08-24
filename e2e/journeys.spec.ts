import { test, expect } from "@playwright/test";

/** Tier 1 — no backend. Proves navigability: routes render (not blank/404),
 *  footer/nav links resolve, primary buttons are wired. Tier 2 (auth + data
 *  flows: create event, guest list, aso-ebi orders) runs in CI via E2E_BACKEND. */

const PUBLIC_ROUTES = ["/", "/auth", "/privacy", "/terms", "/contact", "/vendors"];

for (const path of PUBLIC_ROUTES) {
  test(`route ${path} renders real content (not blank)`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    // SPA: wait for React to hydrate #root before asserting content
    await page.waitForFunction(() => {
      const r = document.querySelector("#root");
      return r && r.textContent && r.textContent.trim().length > 15;
    }, { timeout: 15_000 });
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length).toBeGreaterThan(15);
    await expect(page.locator("body")).not.toContainText(/page not found|doesn't exist/i);
  });
}

test("footer/nav legal links resolve to real routes", async ({ page }) => {
  await page.goto("/");
  for (const [label, expected] of [["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "/contact"]] as const) {
    const link = page.getByRole("link", { name: label, exact: true }).first();
    if (await link.count()) {
      const href = await link.getAttribute("href");
      expect(href, `"${label}" must point at ${expected}`).toContain(expected);
    }
  }
});

test("unauthenticated protected route redirects to auth (not blank)", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/auth/);
});

test("auth page has working email + password inputs and a submit", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  const submit = page.getByRole("button", { name: /sign in|log in|continue|sign up/i }).first();
  await expect(submit).toBeVisible();
});

test("no dead href=# links on the landing page", async ({ page }) => {
  await page.goto("/");
  const deadLinks = await page.locator('a[href="#"]').count();
  expect(deadLinks, "landing must have no dead href=# links").toBe(0);
});
