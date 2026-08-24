import { supabase } from "@/integrations/supabase/client";

type Kind = "route" | "asset";

const recent = new Map<string, number>(); // url -> last logged ts (ms)
const DEDUPE_MS = 60_000;

async function send(kind: Kind, url: string) {
  if (!url) return;
  const key = `${kind}:${url}`;
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return;
  recent.set(key, now);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("client_404_logs").insert({
      url,
      kind,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      user_id: user?.id ?? null,
    });
  } catch {
    /* swallow — never break the app for logging */
  }
}

export const log404Route = (path: string) => send("route", path);

/**
 * Installs a global listener that records failed loads of <img>, <script>,
 * <link>, and <source> elements (typical browser 404s for static assets).
 * Safe to call multiple times — it only installs once.
 */
let installed = false;
export function installAsset404Listener() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target as Element | null;
      if (!target || target === (window as unknown)) return;
      const tag = target.tagName?.toLowerCase();
      if (!tag || !["img", "script", "link", "source", "video", "audio"].includes(tag)) return;
      const url =
        (target as HTMLImageElement).currentSrc ||
        (target as HTMLImageElement).src ||
        (target as HTMLLinkElement).href ||
        "";
      if (!url) return;
      // Ignore data:/blob: URIs and dev HMR noise
      if (/^(data|blob):/.test(url)) return;
      send("asset", url);
    },
    true, // capture: resource errors don't bubble
  );
}
