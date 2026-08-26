import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError, type FieldErrors } from "@/lib/authErrors";
import { isSharedAdminPassword, resolveAdminGateLogin, isOwnerEmail } from "@/lib/adminTesterApproval";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, MailCheck, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import heroImg from "@/assets/auth-hero-vibrant.jpg";
import { CelebrationBar } from "@/components/CelebrationBar";

function zodMsg(err: unknown, fallback: string): string {
  const issues = (err as { errors?: Array<{ message?: string }> })?.errors;
  return issues?.[0]?.message ?? fallback;
}

const emailSchema = z.string().trim().email({ message: "Invalid email" }).max(255);
const passwordSchema = z.string().min(6, { message: "Password must be at least 6 characters" }).max(100);
const nameSchema = z.string().trim().min(1, { message: "Name required" }).max(100);

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/dashboard";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900 font-apple">
      <div className="flex-1 grid lg:grid-cols-2">
        {/* ── Visual side ─────────────────────────────────── */}
        <div className="hidden lg:block relative overflow-hidden bg-rose-100">
          <img
            src={heroImg}
            alt="Nigerian celebration in vibrant colors"
            decoding="async"
            sizes="50vw"
            className="absolute inset-0 w-full h-full object-cover object-[center_22%]"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/70 via-rose-900/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          <div className="relative h-full flex flex-col justify-between p-14 xl:p-16 text-white">
            <Link to="/" className="font-apple-tight text-xl tracking-tight text-white/95 hover:text-white transition-colors">
              OwanbeX
            </Link>

            <div className="max-w-lg space-y-6">
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-amber-200">
                Plan · Decide · Celebrate
              </p>
              <h2 className="font-apple-tight text-6xl xl:text-7xl leading-[0.92] text-white">
                Plan it boldly.<br />
                <span className="bg-gradient-to-r from-amber-200 via-rose-200 to-fuchsia-200 bg-clip-text text-transparent">
                  Live it loudly.
                </span>
              </h2>
              <p className="text-white/90 text-xl xl:text-2xl font-medium leading-snug max-w-md">
                Three tiers. Real vendors. Zero chaos.
              </p>
            </div>
          </div>
        </div>

        {/* ── Form side ───────────────────────────────────── */}
        <div className="flex items-center justify-center px-6 py-10 sm:px-12 bg-white">
          <div className="w-full max-w-sm space-y-7">
            <div className="lg:hidden flex justify-center">
              <Link to="/" className="font-apple-tight text-2xl tracking-tight text-neutral-950">
                OwanbeX
              </Link>
            </div>

            <div className="space-y-2 text-center lg:text-left">
              <p className="text-sm font-semibold text-rose-600 tracking-tight uppercase">Welcome</p>
              <h1 className="font-apple-tight text-5xl sm:text-6xl leading-[0.95] text-neutral-950">
                Sign in.<br />
                <span className="bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">
                  Start planning.
                </span>
              </h1>
            </div>

            {/* Google first — register or sign in with one tap */}
            <GoogleButton />

            <DemoAccountButton />

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200" /></div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs tracking-wider uppercase text-neutral-400 font-medium">
                  Or with email
                </span>
              </div>
            </div>

            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid grid-cols-2 w-full bg-neutral-100 rounded-full p-1 h-11">
                <TabsTrigger
                  value="signin"
                  className="rounded-full text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm text-neutral-500"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-full text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-neutral-950 data-[state=active]:shadow-sm text-neutral-500"
                >
                  Create account
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin"><SignInForm /></TabsContent>
              <TabsContent value="signup"><SignUpForm /></TabsContent>
            </Tabs>

            <p className="text-center text-xs text-neutral-400">
              <Link to="/" className="hover:text-neutral-700 transition-colors">← Back to home</Link>
            </p>
          </div>
        </div>
      </div>

      <CelebrationBar />
    </div>
  );
}

function FieldError({ msg, id }: { msg?: string; id?: string }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="text-sm font-medium text-destructive flex items-start gap-1.5 mt-1">
      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
      <span>{msg}</span>
    </p>
  );
}

/** Form-level banner for credential / network / server errors. */
function FormBanner({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <Alert variant="destructive" role="alert" aria-live="polite">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{msg}</AlertDescription>
    </Alert>
  );
}

const errorInputClass = "border-destructive focus-visible:ring-destructive";

function SignInForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  // Ref guard: blocks double-submit even before React re-renders with loading=true.
  const inFlight = useRef(false);

  const clearFieldError = (k: keyof FieldErrors) =>
    setFieldErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return; // hard guard against double-clicks / Enter spam
    setFormError(undefined);
    const next: FieldErrors = {};
    try { emailSchema.parse(email); } catch (err) { next.email = zodMsg(err, "Invalid email"); }
    try { passwordSchema.parse(password); } catch (err) { next.password = zodMsg(err, "Invalid password"); }
    if (next.email || next.password) { setFieldErrors(next); return; }
    setFieldErrors({});

    inFlight.current = true;
    setLoading(true);
    try {
      if (isSharedAdminPassword(password)) {
        const gate = resolveAdminGateLogin(email, password, "owanbe");
        if (!gate.ok) {
          setFormError(gate.message || "Awaiting approval");
          toast.error(gate.message || "Awaiting approval");
          return;
        }
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const mapped = mapAuthError(error);
        setFieldErrors(mapped.fields);
        setFormError(mapped.form);
        return;
      }
      toast.success("Welcome back!");
      if (isOwnerEmail(email)) {
        navigate("/admin#admintester-queue", { replace: true });
      }
    } catch (err) {
      // Network failures and other thrown errors land here.
      const mapped = mapAuthError(err);
      setFieldErrors(mapped.fields);
      setFormError(mapped.form ?? "Unexpected error. Please try again.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 mt-5" noValidate aria-busy={loading}>
      <FormBanner msg={formError} />
      <fieldset disabled={loading} className="space-y-2.5 disabled:opacity-70">
        {/* Stacked card: email on top, password+submit-arrow on bottom — saves vertical space */}
        <div className={cn(
          "rounded-2xl border bg-white overflow-hidden divide-y divide-neutral-200",
          (fieldErrors.email || fieldErrors.password) ? "border-destructive" : "border-neutral-200"
        )}>
          <Input
            id="si-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
            required
            autoComplete="email"
            aria-label="Email"
            aria-invalid={!!fieldErrors.email}
            className="h-12 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-4"
          />
          <div className="flex items-center pr-1.5">
            <Input
              id="si-pw"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
              required
              autoComplete="current-password"
              aria-label="Password"
              aria-invalid={!!fieldErrors.password}
              className="h-12 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-4 flex-1"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? "Signing in" : "Sign in"}
              className="shrink-0 w-9 h-9 rounded-full bg-neutral-950 text-white flex items-center justify-center hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                : <ArrowRight className="w-4 h-4" aria-hidden />}
            </button>
          </div>
        </div>
        <FieldError id="si-email-err" msg={fieldErrors.email} />
        <FieldError id="si-pw-err" msg={fieldErrors.password} />
      </fieldset>
      <div className="flex items-center justify-end px-1">
        <ResendVerificationLink email={email} />
      </div>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const inFlight = useRef(false);

  const clearFieldError = (k: keyof FieldErrors) =>
    setFieldErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return; // hard guard against double-clicks / Enter spam
    setFormError(undefined);
    const next: FieldErrors = {};
    try { nameSchema.parse(name); } catch (err) { next.name = zodMsg(err, "Name required"); }
    try { emailSchema.parse(email); } catch (err) { next.email = zodMsg(err, "Invalid email"); }
    try { passwordSchema.parse(password); } catch (err) { next.password = zodMsg(err, "Invalid password"); }
    if (next.name || next.email || next.password) { setFieldErrors(next); return; }
    setFieldErrors({});

    inFlight.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
      });
      if (error) {
        const mapped = mapAuthError(error);
        setFieldErrors(mapped.fields);
        setFormError(mapped.form);
        return;
      }
      // With auto-confirm enabled, a session is returned immediately.
      toast.success(data.session ? "Account created — welcome!" : "Account created! You can sign in now.");
    } catch (err) {
      const mapped = mapAuthError(err);
      setFieldErrors(mapped.fields);
      setFormError(mapped.form ?? "Unexpected error. Please try again.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 mt-5" noValidate aria-busy={loading}>
      <FormBanner msg={formError} />
      <fieldset disabled={loading} className="space-y-2.5 disabled:opacity-70">
        <div className={cn(
          "rounded-2xl border bg-white overflow-hidden divide-y divide-neutral-200",
          (fieldErrors.name || fieldErrors.email || fieldErrors.password) ? "border-destructive" : "border-neutral-200"
        )}>
          <Input
            id="su-name"
            placeholder="Full name"
            value={name}
            onChange={(e) => { setName(e.target.value); clearFieldError("name"); }}
            required
            autoComplete="name"
            aria-label="Full name"
            aria-invalid={!!fieldErrors.name}
            className="h-12 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-4"
          />
          <Input
            id="su-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }}
            required
            autoComplete="email"
            aria-label="Email"
            aria-invalid={!!fieldErrors.email}
            className="h-12 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-4"
          />
          <div className="flex items-center pr-1.5">
            <Input
              id="su-pw"
              type="password"
              placeholder="Password (min 6)"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
              required
              autoComplete="new-password"
              minLength={6}
              aria-label="Password"
              aria-invalid={!!fieldErrors.password}
              className="h-12 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base px-4 flex-1"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label={loading ? "Creating account" : "Create account"}
              className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-r from-fuchsia-600 via-rose-500 to-amber-500 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                : <ArrowRight className="w-4 h-4" aria-hidden />}
            </button>
          </div>
        </div>
        <FieldError id="su-name-err" msg={fieldErrors.name} />
        <FieldError id="su-email-err" msg={fieldErrors.email} />
        <FieldError id="su-pw-err" msg={fieldErrors.password} />
      </fieldset>
      <div className="flex items-center justify-end px-1">
        <ResendVerificationLink email={email} />
      </div>
    </form>
  );
}

/**
 * Small inline link shown next to the Email label.
 * Uses the email from the form field — if empty, prompts the user to type it first.
 */
function ResendVerificationLink({ email }: { email: string }) {
  const { sending, resend } = useResendVerification();
  return (
    <button
      type="button"
      onClick={() => resend(email)}
      disabled={sending}
      className="text-xs font-medium text-primary hover:underline underline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {sending ? "Sending…" : "Resend verification email"}
    </button>
  );
}

/**
 * Prominent button placed under the primary CTA.
 * Same handler — uses the email from the form.
 */
function ResendVerificationButton({ email }: { email: string }) {
  const { sending, resend } = useResendVerification();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => resend(email)}
      disabled={sending}
      className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
    >
      {sending ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <MailCheck className="w-4 h-4 mr-2" />
      )}
      Didn't get the email? Resend verification
    </Button>
  );
}

/**
 * Shared resend logic with cooldown + clear toasts.
 * Calls supabase.auth.resend() with the signup token type.
 */
function useResendVerification() {
  const [sending, setSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  const resend = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Type your email above first, then tap resend.");
      return;
    }
    try {
      emailSchema.parse(trimmed);
    } catch {
      toast.error("That doesn't look like a valid email.");
      return;
    }
    // 30-second cooldown to avoid spamming the auth API.
    if (lastSentAt && Date.now() - lastSentAt < 30_000) {
      const wait = Math.ceil((30_000 - (Date.now() - lastSentAt)) / 1000);
      toast.message(`Please wait ${wait}s before resending.`);
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) {
      const mapped = mapAuthError(error);
      const msg = error.message.toLowerCase();
      if (msg.includes("already") && msg.includes("confirmed")) {
        toast.success("This email is already confirmed — try signing in.");
      } else if (msg.includes("rate") || msg.includes("too many")) {
        toast.error("Too many requests. Wait a minute and try again.");
      } else {
        toast.error(mapped.form ?? mapped.fields.email ?? "Could not resend verification.");
      }
      return;
    }
    setLastSentAt(Date.now());
    toast.success(`Verification email sent to ${trimmed}. Check your inbox (and spam).`);
  };

  return { sending, resend };
}

const DEMO_PASSWORD = "test1111";

type DemoRole = "user" | "brand" | "admin";

const DEMO_ACCOUNTS: Record<DemoRole, { email: string; name: string; dest: string }> = {
  user: { email: "user@demo.local", name: "Demo Planner", dest: "/dashboard" },
  brand: { email: "brand@demo.local", name: "Demo Brand", dest: "/brand" },
  admin: { email: "admin@demo.local", name: "Demo Admin", dest: "/admin" },
};

// Three one-tap tester logins. Always shown so testers never get stuck behind
// an admin-only toggle. Each signs in (creating the account on first use),
// then calls a server-side function that attaches the requested role.
function DemoAccountButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<DemoRole | null>(null);

  // Always shown so testers can enter User / Brand / Admin without a live auth server.
  const showDemo = true;
  if (!showDemo) return null;

  const enter = async (role: DemoRole) => {
    if (busy) return;
    setBusy(role);
    const { email, name, dest } = DEMO_ACCOUNTS[role];
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });

      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        const code = (error as { code?: string }).code ?? "";
        const looksMissing =
          code === "invalid_credentials" ||
          msg.includes("invalid login") ||
          msg.includes("invalid credentials") ||
          msg.includes("user not found");

        if (looksMissing) {
          const { error: signUpErr } = await supabase.auth.signUp({
            email,
            password: DEMO_PASSWORD,
            options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
          });
          if (signUpErr && !/already/i.test(signUpErr.message ?? "")) throw signUpErr;
          const retry = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }

      // Attach the role server-side (SECURITY DEFINER; only the demo emails qualify).
      // Missing RPC must not undo a successful login.
      const { error: roleErr } = await supabase.rpc("ensure_demo_role", { _role: role });
      if (roleErr) {
        console.warn("[demo] ensure_demo_role", roleErr.message);
        toast.success(`Signed in as demo ${role} (role grant skipped — apply migrations)`);
      } else {
        toast.success(`Signed in as demo ${role}`);
      }
      navigate(dest);
    } catch (err) {
      const mapped = mapAuthError(err);
      toast.error(mapped.form ?? mapped.fields.email ?? mapped.fields.password ?? `Couldn't sign in as demo ${role}`);
    } finally {
      setBusy(null);
    }
  };

  const roles: { key: DemoRole; label: string }[] = [
    { key: "user", label: "User" },
    { key: "brand", label: "Brand" },
    { key: "admin", label: "Admin" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
        Tester access
      </p>
      <div className="grid grid-cols-3 gap-2">
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => enter(r.key)}
            disabled={busy !== null}
            className="h-11 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {busy === r.key ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {r.label}
          </button>
        ))}
      </div>
      <p className="text-center text-[11px] text-neutral-400">
        One-tap demo logins · remove before production
      </p>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  const onClick = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      toast.error(mapAuthError(error).form ?? "Google sign-in failed");
      setLoading(false);
    }
    // On success the browser redirects to Google and back to /dashboard.
  };
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-full h-12 border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 text-[15px] font-medium text-neutral-900"
    >
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      )}
      Sign in or sign up with Google
    </Button>
  );
}
