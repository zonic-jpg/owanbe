/** Decode AI image responses: data-URLs, bare base64, or remote HTTP(S) URLs. */

const FETCH_TIMEOUT_MS = 45_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function bytesFromBase64(b64: string): Uint8Array {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseDataUrl(url: string): Uint8Array | null {
  const m = url.match(/^data:image\/(?:jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!m) return null;
  try {
    return bytesFromBase64(m[1]);
  } catch {
    return null;
  }
}

/** Extract image bytes from common AI provider response shapes. Retries once on transient failure. */
export async function imageBytesFromAiResponse(data: unknown, attempt = 0): Promise<Uint8Array> {
  const root = data as Record<string, unknown>;
  const choices = root?.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;

  const candidates: string[] = [];

  const images = message?.images as Array<{ image_url?: { url?: string } }> | undefined;
  if (images?.[0]?.image_url?.url) candidates.push(images[0].image_url!.url!);

  const content = message?.content;
  if (typeof content === "string" && content.startsWith("data:image")) candidates.push(content);
  if (Array.isArray(content)) {
    for (const part of content) {
      const p = part as { type?: string; image_url?: { url?: string }; url?: string };
      if (p.image_url?.url) candidates.push(p.image_url.url);
      if (typeof p.url === "string") candidates.push(p.url);
    }
  }

  const dataArr = root?.data as Array<{ b64_json?: string; url?: string }> | undefined;
  if (dataArr?.[0]?.b64_json) {
    try {
      return bytesFromBase64(dataArr[0].b64_json);
    } catch { /* try URL path */ }
  }
  if (dataArr?.[0]?.url) candidates.push(dataArr[0].url!);

  for (const url of candidates) {
    if (!url) continue;
    const fromData = parseDataUrl(url);
    if (fromData) return fromData;
    if (/^https?:\/\//i.test(url)) {
      try {
        const resp = await fetchWithTimeout(url);
        if (!resp.ok) continue;
        const ct = resp.headers.get("content-type") ?? "";
        if (!/image\/(jpeg|jpg|png|webp)/i.test(ct) && ct && !ct.includes("octet-stream")) {
          console.warn(`image-bytes: skip non-image content-type ${ct} for ${url.slice(0, 80)}`);
          continue;
        }
        return new Uint8Array(await resp.arrayBuffer());
      } catch (e) {
        console.warn(`image-bytes: fetch ${url.slice(0, 80)} failed`, e);
      }
    }
  }

  if (attempt < 1) {
    await new Promise((r) => setTimeout(r, 800));
    return imageBytesFromAiResponse(data, attempt + 1);
  }

  throw new Error("No decodable image in AI response (data-URL, base64, or HTTP URL)");
}
