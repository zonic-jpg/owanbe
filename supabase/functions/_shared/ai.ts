// Provider-agnostic AI helper for Supabase Edge Functions.
//
// Provider-agnostic. Point these env vars at ANY
// OpenAI-compatible Chat Completions endpoint. Recommended best-blend setup:
//
//   PRIMARY (cost + reliability):  OpenAI gpt-4o-mini
//     AI_API_URL=https://api.openai.com/v1/chat/completions
//     AI_API_KEY=sk-...        AI_TEXT_MODEL=gpt-4o-mini
//
//   FALLBACK (fast + cheap):       Groq
//     AI_FALLBACK_URL=https://api.groq.com/openai/v1/chat/completions
//     AI_FALLBACK_KEY=gsk_...  AI_FALLBACK_MODEL=llama-3.3-70b-versatile
//
//   FINAL FALLBACK:                built-in rule-based generator (no key, in caller)
//
// Images default to the app's bundled curated photos (free, instant). Set the
// image vars only if you also want AI-generated covers.

type Provider = { url: string; key: string; model: string };

const PRIMARY: Provider = {
  url: Deno.env.get("AI_API_URL") ?? "https://api.openai.com/v1/chat/completions",
  key: Deno.env.get("AI_API_KEY") ?? "",
  model: Deno.env.get("AI_TEXT_MODEL") ?? "gpt-4o-mini",
};
const FALLBACK: Provider = {
  url: Deno.env.get("AI_FALLBACK_URL") ?? "https://api.groq.com/openai/v1/chat/completions",
  key: Deno.env.get("AI_FALLBACK_KEY") ?? "",
  model: Deno.env.get("AI_FALLBACK_MODEL") ?? "llama-3.3-70b-versatile",
};
const AI_IMAGE_URL = Deno.env.get("AI_IMAGE_URL") ?? PRIMARY.url;
const AI_API_KEY = PRIMARY.key; // back-compat alias used by the image helper
const AI_IMAGE_MODEL = Deno.env.get("AI_IMAGE_MODEL") ?? "gpt-4o-mini";

/** True if at least one text provider has a key configured. */
export function aiConfigured(): boolean {
  return PRIMARY.key.length > 0 || FALLBACK.key.length > 0;
}

async function callProvider(p: Provider, prompt: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(content);
    } catch {
      return { summary: String(content), suggestions: [] };
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Try the primary provider, then the fallback. Throws only if both fail/unset. */
export async function aiJson(prompt: string, timeoutMs = 20_000): Promise<unknown> {
  const chain = [PRIMARY, FALLBACK].filter((p) => p.key.length > 0);
  if (chain.length === 0) throw new Error("No AI provider configured");
  let lastErr: unknown;
  for (const p of chain) {
    try {
      return await callProvider(p, prompt, timeoutMs);
    } catch (e) {
      lastErr = e;
      // fall through to the next provider
    }
  }
  throw lastErr ?? new Error("All AI providers failed");
}

/** Generate an image, returning raw bytes. Throws on any failure. */
export async function aiImage(prompt: string, timeoutMs = 40_000): Promise<Uint8Array> {
  if (!AI_API_KEY) throw new Error("AI image not configured (AI_API_KEY missing)");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(AI_IMAGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_IMAGE_MODEL,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`AI image ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const url: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      (data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : undefined);
    if (!url || !url.startsWith("data:image")) throw new Error("No image returned");
    const b64 = url.split(",", 2)[1];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } finally {
    clearTimeout(timer);
  }
}
