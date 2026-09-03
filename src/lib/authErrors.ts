import {
  describeUnreachableSupabase,
  errorText,
  looksLikeFetchFailure,
  mixedContentIssue,
  resolveSupabaseEnv,
  type ViteEnvLike,
} from "./supabaseEnv";
import { publicError, publicMessage } from "./publicMessage";

export type FieldErrors = { email?: string; password?: string; name?: string };

export type MappedAuthError = { fields: FieldErrors; form?: string };

/**
 * Visitor-safe copy for "we cannot reach the sign-in service". The detailed
 * diagnosis (project host, missing env var names, dashboard steps) is real and
 * useful, but only to whoever deploys the app — it is logged and offered to
 * admins instead of being printed under the password field.
 */
const UNREACHABLE_PUBLIC =
  "We can't reach the sign-in service right now. Check your connection and try again in a moment — your details are fine.";

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
    const diagnostic = describeUnreachableSupabase({ env: cfg, pageProtocol, error: err });
    console.warn("[auth]", diagnostic);
    return { fields: {}, form: publicMessage(diagnostic, { fallback: UNREACHABLE_PUBLIC, authFallback: UNREACHABLE_PUBLIC }) };
  }

  const e = err as { message?: string; code?: string; status?: number };
  const msg = (e?.message ?? "").toLowerCase();
  const code = e?.code ?? "";

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return { fields: { email: "This email hasn't been verified yet — resend the verification link below." } };
  }
  if (
    code === "access_pending" ||
    msg.includes("access_pending") ||
    msg.includes("awaiting approval")
  ) {
    const pending =
      (err as { error_description?: string })?.error_description ||
      (err as { msg?: string })?.msg ||
      "Awaiting approval — the owner must approve your admin access before you can sign in.";
    return { fields: {}, form: pending };
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
    const diagnostic = describeUnreachableSupabase({ env: cfg, pageProtocol, error: err });
    console.warn("[auth]", diagnostic);
    return { fields: {}, form: publicMessage(diagnostic, { fallback: UNREACHABLE_PUBLIC, authFallback: UNREACHABLE_PUBLIC }) };
  }
  // Anything left is unrecognised driver text — "Unauthorized", "JWT expired",
  // "permission denied for table …". None of that is actionable for a visitor.
  return { fields: {}, form: publicError(raw, "We couldn't complete that sign-in. Please try again.") };
}
