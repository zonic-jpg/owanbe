/**
 * Server-backed ADMINTESTER approval queue.
 *
 * `adminTesterApproval.ts` keeps a localStorage mirror so the sign-in gate
 * still resolves while offline, but localStorage alone could never work: a
 * request written on the tester's device is invisible on the owner's device,
 * which is why the owner's queue was always empty. These wrappers talk to the
 * security-definer RPCs added in
 * supabase/migrations/20260902120000_admin_access_requests.sql.
 *
 * Kept in its own module (rather than inside adminTesterApproval.ts) because
 * the Supabase client imports the local stand-in, which imports the approval
 * gate — importing the client back into the gate would close that cycle.
 */
import { supabase } from "@/integrations/supabase/client";

export const APP_ID = "owanbe";

export type AccessStatus = "none" | "pending" | "approved" | "revoked" | "owner";

export type AccessRequestRow = {
  email: string;
  identity?: string | null;
  app?: string | null;
  status?: AccessStatus;
  requested_at?: string | null;
  decided_at?: string | null;
};

export type AccessQueue = {
  pending: AccessRequestRow[];
  approved: AccessRequestRow[];
  revoked: AccessRequestRow[];
};

export const EMPTY_QUEUE: AccessQueue = { pending: [], approved: [], revoked: [] };

/** The RPCs return `jsonb`, which supabase-js types as a broad Json union. */
function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

/**
 * Record a request for admin access. Safe to call without a session — the RPC
 * is granted to anon precisely so an unapproved tester can still reach the
 * owner. Never throws; the caller has already shown the "awaiting approval"
 * notice and a failure here must not turn into a second error on screen.
 */
export async function submitAccessRequest(email: string, identity?: string): Promise<AccessStatus | null> {
  try {
    const { data, error } = await supabase.rpc("request_admin_access", {
      _email: email,
      _identity: identity ?? email,
      _app: APP_ID,
    });
    if (error) {
      console.warn("[access] request_admin_access", error.message);
      return null;
    }
    return (asRecord(data).status as AccessStatus) ?? "pending";
  } catch (err) {
    console.warn("[access] request_admin_access", err);
    return null;
  }
}

/** A tester's own status, so an approval taking effect does not need a support ping. */
export async function fetchOwnAccessStatus(email: string): Promise<AccessStatus | null> {
  try {
    const { data, error } = await supabase.rpc("admin_access_status", {
      _email: email,
      _app: APP_ID,
    });
    if (error) return null;
    return (asRecord(data).status as AccessStatus) ?? "none";
  } catch {
    return null;
  }
}

export type QueueResult =
  | { ok: true; queue: AccessQueue }
  | { ok: false; reason: "unauthenticated" | "unavailable" };

/**
 * Read the queue as the owner. Returns a discriminated result rather than
 * throwing so the panel can distinguish "nothing pending" (a real empty
 * state) from "we could not read it" — conflating the two is what made the
 * old panel look permanently empty.
 */
export async function fetchAccessQueue(): Promise<QueueResult> {
  try {
    const { data, error } = await supabase.rpc("list_admin_access_requests", { _app: APP_ID });
    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      const unauthenticated =
        msg.includes("admin sign-in required") ||
        msg.includes("permission denied") ||
        msg.includes("jwt") ||
        msg.includes("row-level security");
      return { ok: false, reason: unauthenticated ? "unauthenticated" : "unavailable" };
    }
    const q = asRecord(data);
    const rows = (v: unknown) => (Array.isArray(v) ? (v as AccessRequestRow[]) : []);
    return {
      ok: true,
      queue: { pending: rows(q.pending), approved: rows(q.approved), revoked: rows(q.revoked) },
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export type DecisionResult = { ok: boolean; serverApplied: boolean; message?: string };

/** Approve or reject a tester. Reports whether the decision reached the server. */
export async function decideAccessRequest(
  email: string,
  decision: "approve" | "reject",
): Promise<DecisionResult> {
  try {
    const { data, error } = await supabase.rpc("decide_admin_access", {
      _email: email,
      _decision: decision,
      _app: APP_ID,
    });
    if (error) return { ok: false, serverApplied: false, message: error.message };
    const ok = asRecord(data).ok === true;
    return { ok, serverApplied: ok };
  } catch (err) {
    return { ok: false, serverApplied: false, message: (err as { message?: string })?.message };
  }
}
