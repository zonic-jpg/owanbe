/** Defensive helpers for remote cover / theme image URLs. */

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;
const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif|avif)/i;

export function isLocalAssetUrl(url: string): boolean {
  const u = url.trim();
  return (
    !u ||
    u.startsWith("data:") ||
    u.startsWith("blob:") ||
    u.startsWith("/") ||
    !/^https?:\/\//i.test(u)
  );
}

/** Reject obvious non-image URLs before we even hit the network. */
export function looksLikeImageUrl(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  if (!u) return false;
  if (isLocalAssetUrl(u)) return true;
  if (IMAGE_EXT.test(u)) return true;
  // Supabase storage and common CDNs often omit extensions.
  if (/supabase\.co\/storage|cloudinary|unsplash|imgix/i.test(u)) return true;
  // Block HTML/JSON/text endpoints that would render as broken tiles.
  if (/\.(html?|json|xml|txt|css|js)(\?|$)/i.test(u)) return false;
  return true;
}

/** HEAD probe with MIME guard. CORS failures are non-fatal — img onload is the final arbiter. */
export async function probeImageUrl(
  url: string,
  timeoutMs = 6_000,
): Promise<{ ok: boolean; reason?: string }> {
  if (isLocalAssetUrl(url)) return { ok: true };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, mode: "cors" });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !IMAGE_MIME.test(ct) && !ct.includes("octet-stream")) {
      return { ok: false, reason: `Not an image (${ct.split(";")[0]})` };
    }
    return { ok: true };
  } catch {
    return { ok: true, reason: "probe skipped (CORS or network)" };
  }
}

/** Cache-bust remote URLs on retry attempts. */
export function withRetryBust(url: string, attempt: number): string {
  if (attempt <= 0 || isLocalAssetUrl(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}_owr=${attempt}&t=${Date.now()}`;
}

export const MAX_COVER_RETRIES = 2;
