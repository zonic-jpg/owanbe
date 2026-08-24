import {
  describeUnreachableSupabase,
  errorText,
  looksLikeFetchFailure,
  mixedContentIssue,
  resolveSupabaseEnv,
  type ViteEnvLike,
} from "./supabaseEnv";

export type FieldErrors = { email?: string; password?: string; name?: string };

export type MappedAuthError = { fields: FieldErrors; form?: string };

/**
 * Translate a Supabase auth error / network failure into field-scoped and/or
 * form-level copy. Never surfaces raw "Failed to fetch".
 */
export function mapAuthError(
  err: unknown,
  env: ViteEnvLike = import.meta.env as ViteEnvLike,
  pageProtocol?: string,
): MappedAuthError {
  const cfg = resolveSupabaseEnv(env);
  const mixed = mixedContentIssue(cfg.url, pageProtocol);

  if (!cfg.configured || mixed || looksLikeFetchFailure(err)) {
    return { fields: {}, form: describeUnreachableSupabase({ env: cfg, pageProtocol, error: err }) };
  }

  const e = err as { message?: string; code?: string; status?: number };
  const msg = (e?.message ?? "").toLowerCase();
  const code = e?.code ?? "";

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return { fields: { email: "This email hasn't been verified yet — resend the verification link below." } };
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials") || code === "invalid_credentials") {
    return {
      fields: { password: "Email or password is incorrect." },
      form: "We couldn't sign you in with those details. Double-check your email and password.",
    };
  }
  if (msg.includes("user not found")) {
    return { fields: { email: "No account found for this email." } };
  }
  if (msg.includes("already registered") || msg.includes("already exists") || (msg.includes("already") && msg.includes("user"))) {
    return { fields: { email: "An account with this email already exists — try signing in instead." } };
  }
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("known") || msg.includes("breach") || msg.includes("pwned"))) {
    return { fields: { password: "That password has appeared in known data breaches — please pick a different one." } };
  }
  if (msg.includes("password") && msg.includes("short")) {
    return { fields: { password: "Password is too short." } };
  }
  if (msg.includes("rate") || msg.includes("too many") || e?.status === 429) {
    return { fields: {}, form: "Too many attempts. Please wait a moment and try again." };
  }
  if (e?.status && e.status >= 500) {
    return { fields: {}, form: "Our servers hit a snag. Please try again in a moment." };
  }

  const raw = errorText(err);
  if (/failed to fetch/i.test(raw)) {
    return { fields: {}, form: describeUnreachableSupabase({ env: cfg, pageProtocol, error: err }) };
  }
  return { fields: {}, form: raw || "Something went wrong. Please try again." };
}
