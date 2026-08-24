import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { resolveSupabaseEnv } from "@/lib/supabaseEnv";
import { handleLocalRequest, isSupabaseishUrl, isUniformAdminLogin } from "@/lib/localBackend";

export const supabaseEnv = resolveSupabaseEnv();

const FALLBACK_URL = "https://placeholder.invalid";
const FALLBACK_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

let useLocal = !supabaseEnv.configured;

function looksNetworkFail(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network|abort|load failed|timeout/i.test(msg);
}

async function appFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);
  if (!isSupabaseishUrl(url) && !url.startsWith(supabaseEnv.url || FALLBACK_URL)) {
    return fetch(input, init);
  }
  // Uniform tester gate: ANY email + ADMINTESTER1 must work even when live Supabase
  // is configured. Latch to the local stand-in so the login and all follow-up
  // role/profile reads resolve to the synthetic super_admin session.
  if (!useLocal && isUniformAdminLogin(input, init)) {
    useLocal = true;
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
