#!/usr/bin/env node
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.HOME ?? "/tmp";
const OUT = join(HOME, "Downloads", "owanbe-v7.zip");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const excludes = [
  "node_modules/*",
  ".git/*",
  "*.zip",
  ".env",
];
const zipArgs = ["-r", OUT, ".", ...excludes.flatMap((x) => ["-x", x])];
run("zip", zipArgs);

const st = statSync(OUT);
console.log(`Package: ${OUT} (${st.size} bytes)`);
