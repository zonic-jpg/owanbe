/** Vite env names used by this app and by AWS/Railway docs. */

export type ViteEnvLike = Record<string, string | boolean | undefined>;

export type SupabaseEnvStatus = {
  url: string;
  anonKey: string;
  projectHost: string;
  configured: boolean;
  issues: string[];
};

const PLACEHOLDER_HOSTS = new Set([
  "placeholder.supabase.co",
  "placeholder.invalid",
  "your_project.supabase.co",
  "your-project.supabase.co",
]);

function stripQuotes(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/^["']+|["']+$/g, "").trim();
}

function readKey(env: ViteEnvLike, names: string[]): string {
  for (const name of names) {
    const v = stripQuotes(env[name]);
    if (v) return v;
  }
  return "";
}

export function resolveSupabaseEnv(env: ViteEnvLike = import.meta.env as ViteEnvLike): SupabaseEnvStatus {
  const url = readKey(env, ["VITE_SUPABASE_URL"]);
  const anonKey = readKey(env, [
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_KEY",
  ]);

  const issues: string[] = [];
  let projectHost = "";

  if (!url) {
    issues.push(
      "Missing VITE_SUPABASE_URL. Set it in .env (local) or in Railway/AWS/Amplify build variables, then rebuild.",
    );
  } else {
    try {
      const parsed = new URL(url);
      projectHost = parsed.host;
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        issues.push(`VITE_SUPABASE_URL must be http(s). Got: ${parsed.protocol}`);
      }
      if (PLACEHOLDER_HOSTS.has(parsed.host.toLowerCase()) || /YOUR_PROJECT/i.test(url)) {
        issues.push("VITE_SUPABASE_URL is still a placeholder. Paste the real Project URL from Supabase → Settings → API.");
      }
    } catch {
      issues.push(`VITE_SUPABASE_URL is not a valid URL: ${url}`);
    }
  }

  if (!anonKey) {
    issues.push(
      "Missing API key. Set VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY (anon/public key from Supabase → Settings → API), then rebuild.",
    );
  } else if (/your-anon-key|your_anon|placeholder-anon/i.test(anonKey)) {
    issues.push("The anon key is still a placeholder. Paste the anon public key from Supabase → Settings → API.");
  }

  return {
    url,
    anonKey,
    projectHost,
    configured: issues.length === 0,
    issues,
  };
}

export function mixedContentIssue(url: string, pageProtocol?: string): string | null {
  const proto = pageProtocol ?? (typeof window !== "undefined" ? window.location.protocol : undefined);
  if (proto === "https:" && url.startsWith("http://")) {
    return "This page is HTTPS but the API URL is HTTP. Browsers block that (mixed content). Use https://YOUR_REF.supabase.co";
  }
  return null;
}

/** Human-readable reason testers should never see as raw "Failed to fetch". */
export function describeUnreachableSupabase(opts: {
  env: SupabaseEnvStatus;
  pageProtocol?: string;
  error?: unknown;
}): string {
  const mixed = mixedContentIssue(opts.env.url, opts.pageProtocol);
  if (mixed) return mixed;
  if (!opts.env.configured) {
    return opts.env.issues[0] ?? "Supabase is not configured for this build.";
  }

  const host = opts.env.projectHost || "the API host";
  const msg = errorText(opts.error).toLowerCase();

  if (msg.includes("aborted") || msg.includes("timeout")) {
    return `Timed out reaching ${host}. Check your network, VPN, and that the Supabase project is not paused.`;
  }

  return [
    `Cannot reach ${host}. This is a network/hosting problem, not a wrong password.`,
    "Check: (1) Supabase project is not paused, (2) VITE_SUPABASE_URL matches Settings → API,",
    "(3) Authentication → URL Configuration includes this site's origin, (4) supabase.co is not blocked.",
  ].join(" ");
}

export function errorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const e = err as { message?: string; details?: string; error_description?: string };
  return e.message || e.details || e.error_description || "";
}

export function looksLikeFetchFailure(err: unknown): boolean {
  const name = err && typeof err === "object" ? String((err as { name?: string }).name ?? "") : "";
  const msg = errorText(err).toLowerCase();
  return (
    name === "TypeError" ||
    name === "AuthRetryableFetchError" ||
    /failed to fetch|networkerror|load failed|fetch failed|network request failed|err_name_not_resolved|err_connection|err_ssl|err_timed_out|cors|aborted/.test(msg)
  );
}
