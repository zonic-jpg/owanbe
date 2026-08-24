#!/usr/bin/env node
import { createWriteStream, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.HOME ?? "/tmp";
const OUT = join(HOME, "Downloads", "owanbe-v6-staging.zip");
const ALT = join(HOME, "Downloads", "Owanbe-Joy-v6-20260730.zip");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(join(ROOT, "docs/OWANBE-FIX-REPORT.pdf"))) {
  run(process.execPath, ["scripts/render-all-pdfs.mjs"]);
}

const excludes = [
  "node_modules/*",
  ".git/*",
  "*.zip",
  ".env",
];
const zipArgs = ["-r", OUT, ".", ...excludes.flatMap((x) => ["-x", x])];
run("zip", zipArgs);

if (OUT !== ALT) {
  run("cp", ["-f", OUT, ALT]);
}

const st = statSync(OUT);
console.log(`Package: ${OUT} (${st.size} bytes)`);
console.log(`Copy:    ${ALT}`);
