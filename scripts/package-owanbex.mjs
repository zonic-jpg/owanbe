#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.HOME ?? "/tmp";
const OUT = join(HOME, "Downloads", "owanbex-v1.zip");
const ALIAS = join(HOME, "Downloads", "owanbex-latest.zip");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const excludes = [
  "node_modules/*",
  "node_modules/**",
  ".git/*",
  ".git/**",
  "*.zip",
  ".env",
  "playwright-report/*",
  "test-results/*",
];
run("rm", ["-f", OUT, ALIAS]);
run("zip", ["-r", OUT, ".", ...excludes.flatMap((x) => ["-x", x])]);
run("cp", ["-f", OUT, ALIAS]);
if (!existsSync(OUT)) {
  console.error("zip missing:", OUT);
  process.exit(1);
}
const st = statSync(OUT);
console.log(`Package: ${OUT} (${st.size} bytes)`);
console.log(`Alias:   ${ALIAS}`);
