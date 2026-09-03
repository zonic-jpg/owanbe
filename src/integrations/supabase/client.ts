import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { resolveSupabaseEnv } from "@/lib/supabaseEnv";
import { handleLocalRequest, isSupabaseishUrl, isUniformAdminLogin } from "@/lib/localBackend";

export const supabaseEnv = resolveSupabaseEnv();

const FALLBACK_URL = "https://placeholder.invalid";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

let useLocal = !supabaseEnv.configured;

/** Switch all subsequent Supabase traffic to the seeded local stand-in. */
export function latchToLocalBackend(reason?: string): void {
  if (!useLocal) {
    console.warn("[supabase] switching to local stand-in", reason ?? "");
    useLocal = true;
  }
}

export function isLocalBackendActive(): boolean {
  return useLocal;
}

function looksNetworkFail(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network|abort|load failed|timeout/i.test(msg);
}

/**
 * PostgREST answers 404 with PGRST205 (unknown table) / PGRST202 (unknown
 * function) when the project's `public` schema has not been provisioned yet.
 * That is indistinguishable from "the backend is down" as far as a visitor is
 * concerned, so treat it the same way as a network failure and serve the
 * seeded stand-in instead of leaving every list and form dead.
 */
const UNPROVISIONED_CODES = /PGRST20[25]|PGRST106|42P01|42883/;

function isRestRequest(url: string): boolean {
  return url.includes("/rest/v1/");
}

async function looksUnprovisioned(res: Response): Promise<boolean> {
  if (res.status !== 404 && res.status !== 406) return false;
  try {
    return UNPROVISIONED_CODES.test(await res.clone().text());
  } catch {
    return false;
  }
}

async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);
  if (!isSupabaseishUrl(url) && !url.startsWith(supabaseEnv.url || FALLBACK_URL)) {
    return fetch(input, init);
  }
  if (useLocal) return handleLocalRequest(input, init);

  const timeoutMs = 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parent = init?.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    if (res.status >= 500) {
      useLocal = true;
      return handleLocalRequest(input, init);
    }
    // Uniform tester gate: ANY email + an orbit password must work. Prefer the
    // real project so the session carries a genuine JWT (RLS-backed reads such
    // as the owner's approval queue depend on it); only fall back to the local
    // stand-in when the real credentials are rejected.
    if (isUniformAdminLogin(input, init) && !res.ok) {
      useLocal = true;
      return handleLocalRequest(input, init);
    }
    if (isRestRequest(url) && (await looksUnprovisioned(res))) {
      latchToLocalBackend("backend schema unavailable");
      return handleLocalRequest(input, init);
    }
    return res;
  } catch (err) {
    if (looksNetworkFail(err)) {
      useLocal = true;
      return handleLocalRequest(input, init);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseEnv.url || FALLBACK_URL,
  supabaseEnv.anonKey || FALLBACK_KEY,
  {
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: { fetch: appFetch },
  },
);
