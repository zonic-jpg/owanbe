/**
 * Zonic ADMINTESTER approval — OwanbeX.
 * Orbit standard: ~/Downloads/MyYangaX-COMPLETE/AUTH.md
 */
import { FOUNDING_OWNER_EMAIL, isFoundingOwnerEmail } from "./foundingOwner";

export const OWNER_EMAIL = FOUNDING_OWNER_EMAIL;
export const APPROVAL_STORE_KEY = "zonic_admintester_approval_v1";
export const ADMIN_PASSWORDS = ["zonicGate2026a", "zonicGate2026b", "zonicStudio2026"];
export const AWAITING_MSG =
  "Awaiting approval — the owner must approve your admin access before you can sign in. You will be notified once approved.";

/** Shown to the owner above the queue. AWAITING_MSG is written for the person
 *  being kept out, so using it here told the owner they needed their own
 *  approval. */
export const OWNER_QUEUE_HINT =
  "People who asked for admin access appear here. Approving grants the admin role; rejecting keeps them out.";

export function isSharedAdminPassword(password: unknown): boolean {
  const candidate = String(password ?? "").trim().toLowerCase();
  return ADMIN_PASSWORDS.some((p) => p.toLowerCase() === candidate);
}

export function isOwnerEmail(email: string): boolean {
  return isFoundingOwnerEmail(email);
}

export function identityToEmail(identity: string): string {
  const raw = String(identity || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();
  const safe = raw.replace(/[^a-zA-Z0-9._+-]/g, "").toLowerCase() || "user";
  return `${safe}@admin.local`;
}

type Store = {
  pending: Array<{ email: string; identity?: string; app?: string; requestedAt: string }>;
  approved: Array<{ email: string; approvedAt: string; approvedBy: string }>;
  revoked: Array<{ email: string; revokedAt: string; revokedBy: string }>;
};

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(APPROVAL_STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* seed */
  }
  return { pending: [], approved: [], revoked: [] };
}

function saveStore(store: Store) {
  try {
    localStorage.setItem(APPROVAL_STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

const norm = identityToEmail;

export function isApproved(email: string) {
  const e = norm(email);
  if (isOwnerEmail(e)) return true;
  if (loadStore().revoked.some((r) => norm(r.email) === e)) return false;
  return loadStore().approved.some((a) => norm(a.email) === e);
}

export function listPendingQueue(appFilter?: string) {
  const pending = loadStore().pending.filter((p) => !isApproved(p.email));
  return appFilter ? pending.filter((p) => !p.app || p.app === appFilter) : pending;
}

export function listApprovedAdmins() {
  return loadStore().approved;
}

export async function notifyOwnerPending(requesterEmail: string, appId: string) {
  try {
    const url = import.meta.env.VITE_ZONIC_NOTIFY_URL;
    if (url) {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: OWNER_EMAIL, requester: requesterEmail, app: appId }),
      });
    }
  } catch {
    /* fail-open */
  }
}

export function queuePendingApproval(identity: string, appId = "owanbe") {
  const email = norm(identity);
  if (!email || isOwnerEmail(email)) return { ok: true as const, status: "owner" as const };
  if (isApproved(email)) return { ok: true as const, status: "approved" as const };
  const store = loadStore();
  if (!store.pending.some((p) => norm(p.email) === email)) {
    store.pending.unshift({
      email,
      identity: String(identity || "").trim(),
      app: appId,
      requestedAt: new Date().toISOString(),
    });
    saveStore(store);
    void notifyOwnerPending(email, appId);
  }
  return { ok: false as const, status: "pending" as const, email, message: AWAITING_MSG };
}

export function resolveAdminGateLogin(identity: string, password: string, appId = "owanbe") {
  if (!isSharedAdminPassword(password)) return { ok: false as const, status: "not_admin_password" as const };
  const email = norm(identity);
  if (!email) return { ok: false as const, status: "invalid" as const, message: "Enter any email with admin password." };
  if (isOwnerEmail(email)) return { ok: true as const, status: "owner" as const, email };
  if (loadStore().revoked.some((r) => norm(r.email) === email)) {
    return {
      ok: false as const,
      status: "revoked" as const,
      email,
      message: "Admin access was revoked. Contact the owner to request access again.",
    };
  }
  if (isApproved(email)) return { ok: true as const, status: "approved" as const, email };
  return queuePendingApproval(identity, appId);
}

/**
 * Fold the authoritative server queue into the local mirror so the sync
 * sign-in gate (which cannot await a network call) agrees with what the owner
 * decided on another device.
 */
export function mergeServerQueue(server: {
  pending: Array<{ email: string; identity?: string | null; requested_at?: string | null }>;
  approved: Array<{ email: string; decided_at?: string | null }>;
  revoked: Array<{ email: string; decided_at?: string | null }>;
}): void {
  const store = loadStore();
  const byEmail = <T extends { email: string }>(rows: T[]) => new Map(rows.map((r) => [norm(r.email), r]));

  const serverApproved = byEmail(server.approved);
  const serverRevoked = byEmail(server.revoked);
  const serverPending = byEmail(server.pending);

  store.approved = [
    ...server.approved.map((a) => ({
      email: norm(a.email),
      approvedAt: a.decided_at ?? new Date().toISOString(),
      approvedBy: OWNER_EMAIL,
    })),
    ...store.approved.filter((a) => {
      const e = norm(a.email);
      return !serverApproved.has(e) && !serverRevoked.has(e) && !serverPending.has(e);
    }),
  ];
  store.revoked = [
    ...server.revoked.map((r) => ({
      email: norm(r.email),
      revokedAt: r.decided_at ?? new Date().toISOString(),
      revokedBy: OWNER_EMAIL,
    })),
    ...store.revoked.filter((r) => {
      const e = norm(r.email);
      return !serverApproved.has(e) && !serverRevoked.has(e) && !serverPending.has(e);
    }),
  ];
  store.pending = [
    ...server.pending.map((p) => ({
      email: norm(p.email),
      identity: p.identity ?? undefined,
      app: "owanbe",
      requestedAt: p.requested_at ?? new Date().toISOString(),
    })),
    ...store.pending.filter((p) => {
      const e = norm(p.email);
      return !serverApproved.has(e) && !serverRevoked.has(e) && !serverPending.has(e);
    }),
  ];
  saveStore(store);
}

export function approveAdmin(actorEmail: string, targetEmail: string) {
  if (!isOwnerEmail(actorEmail)) return { ok: false as const, error: "Only the owner can approve." };
  const email = norm(targetEmail);
  const store = loadStore();
  store.pending = store.pending.filter((p) => norm(p.email) !== email);
  store.revoked = store.revoked.filter((r) => norm(r.email) !== email);
  store.approved.unshift({ email, approvedAt: new Date().toISOString(), approvedBy: OWNER_EMAIL });
  saveStore(store);
  return { ok: true as const, email };
}

export function revokeAdmin(actorEmail: string, targetEmail: string) {
  if (!isOwnerEmail(actorEmail)) return { ok: false as const, error: "Only the owner can revoke." };
  const email = norm(targetEmail);
  if (isOwnerEmail(email)) return { ok: false as const, error: "Cannot revoke owner." };
  const store = loadStore();
  store.approved = store.approved.filter((a) => norm(a.email) !== email);
  store.pending = store.pending.filter((p) => norm(p.email) !== email);
  store.revoked.unshift({ email, revokedAt: new Date().toISOString(), revokedBy: OWNER_EMAIL });
  saveStore(store);
  return { ok: true as const, email };
}
