#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.HOME ?? "/tmp";
const JSPDF = process.env.JSPDF_PATH ?? "/Users/olufemiadeagbo/Downloads/AdSpot-Unified-3/node_modules/jspdf";
const DATE = "30 July 2026";

const jobs = [
  {
    md: "docs/OWANBE-FIX-REPORT.md",
    out: "docs/OWANBE-FIX-REPORT.pdf",
    copy: join(HOME, "Downloads/Owanbe-Fix-Report-20260730.pdf"),
    title: "Owanbe Planner — Fix Report",
    subtitle: "Schema, super admin, reviewer access",
  },
  {
    md: "docs/AWS_DEPLOY_GUIDE.md",
    out: "docs/AWS_DEPLOY_GUIDE.pdf",
    copy: join(HOME, "Downloads/Owanbe-AWS-Deploy-Guide-20260730.pdf"),
    title: "Owanbe — AWS Deploy Guide",
    subtitle: "Static SPA · S3 · CloudFront · Amplify",
  },
  {
    md: "docs/RAILWAY_STAGING_GUIDE.md",
    out: "docs/RAILWAY_STAGING_GUIDE.pdf",
    copy: join(HOME, "Downloads/Owanbe-Railway-Staging-Guide-20260730.pdf"),
    title: "Owanbe — Railway Staging Guide",
    subtitle: "Staging deploy · Supabase migrations first",
  },
];

for (const job of jobs) {
  const r = spawnSync(
    process.execPath,
    [join(ROOT, "scripts/render-one-pdf.mjs")],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        OWANBE_ROOT: ROOT,
        JSPDF_PATH: JSPDF,
        MD_REL: job.md,
        OUT_REL: job.out,
        COPY_PATH: job.copy,
        DOC_TITLE: job.title,
        DOC_SUBTITLE: job.subtitle,
        DOC_DATE: DATE,
      },
    },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("All PDFs rendered.");
