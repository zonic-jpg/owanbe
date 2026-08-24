import { supabase } from "@/integrations/supabase/client";

const ACCESS_TIMEOUT_MS = 8_000;

/** Sync server-side roles/perms after sign-in. Never throws; never blocks login. */
export async function ensureSessionAccess(): Promise<boolean> {
  try {
    const timedOut = { error: { message: "timeout" } } as const;
    const result = await Promise.race([
      supabase.rpc("ensure_session_access"),
      new Promise<typeof timedOut>((resolve) => {
        setTimeout(() => resolve(timedOut), ACCESS_TIMEOUT_MS);
      }),
    ]);
    if (result.error) {
      console.warn("[ensureSessionAccess]", result.error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[ensureSessionAccess]", err);
    return false;
  }
}
