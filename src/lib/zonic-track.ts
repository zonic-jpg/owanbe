// ZonicMe tracking — the bridge between this app and the data spine.
//
// Emits the canonical event envelope defined in the ZonicMe Data Spine Spec.
// It is consent-gated and non-blocking: if the spine endpoint isn't configured
// yet (no VITE_ZONICME_INGEST_URL) or is unreachable, events buffer locally and
// flush later, so tracking NEVER slows or breaks the app — and the app is ready
// to feed ZonicMe the moment the endpoint exists.
//
// Config: set VITE_ZONICME_INGEST_URL to the spine ingestion endpoint when ready.

import { supabase } from "@/integrations/supabase/client";

const APP = "owanbeplanner";
const VERTICAL = "events";
const INGEST_URL = import.meta.env.VITE_ZONICME_INGEST_URL as string | undefined;
const ANON_KEY = "zonic_anon_id";
const CONSENT_KEY = "zonic_consent";
const BUFFER_KEY = "zonic_buffer";

export type ConsentScopes = {
  analytics: boolean; // aggregate use within this app
  cross_app: boolean; // linkable across ZonicMe apps
  research: boolean; // included (anonymised) in insight products
  marketing: boolean; // contactable for offers
};

const DEFAULT_CONSENT: ConsentScopes = { analytics: true, cross_app: false, research: false, marketing: false };

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function getConsent(): ConsentScopes {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) return { ...DEFAULT_CONSENT, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_CONSENT;
}

export function setConsent(scopes: Partial<ConsentScopes>): ConsentScopes {
  const next = { ...getConsent(), ...scopes };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

const sessionId = uuid();

type TrackInput = {
  entity?: { type: string; id?: string; category?: string };
  value?: { amount: number; currency: string };
  properties?: Record<string, unknown>;
};

function buildEnvelope(eventType: string, input: TrackInput, zonicId: string | null) {
  const consent = getConsent();
  return {
    event_id: uuid(),
    occurred_at: new Date().toISOString(),
    app: APP,
    vertical: VERTICAL,
    subject: { anon_id: getAnonId(), zonic_id: consent.cross_app ? zonicId : null },
    consent,
    event_type: eventType,
    entity: input.entity ?? null,
    session_id: sessionId,
    device: { platform: "web", form: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop" },
    value: input.value ?? null,
    properties: input.properties ?? {},
  };
}

function bufferEvent(env: unknown) {
  try {
    const arr = JSON.parse(localStorage.getItem(BUFFER_KEY) ?? "[]");
    arr.push(env);
    // keep the buffer bounded
    localStorage.setItem(BUFFER_KEY, JSON.stringify(arr.slice(-500)));
  } catch {
    /* ignore */
  }
}

async function send(env: unknown): Promise<boolean> {
  if (!INGEST_URL) return false;
  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(env),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Record a behavioural event. Fire-and-forget — never await it in a hot path.
 * Respects consent: with analytics off, nothing is emitted at all.
 */
export function track(eventType: string, input: TrackInput = {}): void {
  const consent = getConsent();
  if (!consent.analytics) return;

  let zonicId: string | null = null;
  try {
    zonicId = supabase.auth.getSession ? null : null; // resolved async below
  } catch {
    zonicId = null;
  }

  // Resolve the signed-in user id (used as zonic_id only if cross_app consent is on).
  (async () => {
    let id: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      id = data?.user?.id ?? null;
    } catch {
      /* ignore */
    }
    const env = buildEnvelope(eventType, input, id);
    const ok = await send(env);
    if (!ok) bufferEvent(env);
  })();
}

/** Try to flush any buffered events (e.g. on app start). Safe to call anytime. */
export async function flush(): Promise<void> {
  if (!INGEST_URL) return;
  let arr: unknown[] = [];
  try {
    arr = JSON.parse(localStorage.getItem(BUFFER_KEY) ?? "[]");
  } catch {
    return;
  }
  if (arr.length === 0) return;
  const remaining: unknown[] = [];
  for (const env of arr) {
    const ok = await send(env);
    if (!ok) remaining.push(env);
  }
  try {
    localStorage.setItem(BUFFER_KEY, JSON.stringify(remaining));
  } catch {
    /* ignore */
  }
}
