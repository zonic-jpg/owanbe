import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Guardrail: every absolute path referenced from index.html
 * (e.g. /favicon.ico, /og-image.jpg) must exist in public/.
 * Prevents silent 404s on first page load.
 */
describe("index.html public asset references", () => {
  const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
  const publicDir = resolve(__dirname, "../../public");

  // Match href="/..." and content="/..." but skip "/" alone, "//external", and "/src/..." (dev-only)
  const refs = Array.from(
    html.matchAll(/(?:href|src|content)=["'](\/[^"'#?]+)["']/g),
  )
    .map((m) => m[1])
    .filter((p) => p !== "/" && !p.startsWith("//") && !p.startsWith("/src/"));

  it.each(refs)("%s exists in public/", (path) => {
    expect(existsSync(resolve(publicDir, path.replace(/^\//, "")))).toBe(true);
  });
});
