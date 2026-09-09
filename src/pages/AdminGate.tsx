import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { beginAdminGateAttempt, endAdminGateAttempt } from "@/lib/localBackend";
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError, type FieldErrors } from "@/lib/authErrors";
import { AWAITING_MSG, isSharedAdminPassword, resolveAdminGateLogin, isOwnerEmail } from "@/lib/adminTesterApproval";
import { submitAccessRequest } from "@/lib/adminAccessRequests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import Admin from "./Admin";

const DEMO_PASSWORD = "test1111";
const DEMO_ADMIN = { email: "admin@demo.local", name: "Chidi Okonkwo" };

/**
 * The ONLY sign-in surface in the app that accepts the shared admin password
 * (see isSharedAdminPassword / beginAdminGateAttempt) — deliberately not the
 * public sign-in form mounted at /auth and /login (src/pages/Auth.tsx), and
 * reachable only by navigating to /admin directly. Once signed in with admin
 * access this renders the real Admin dashboard in place.
 */
export default function AdminGate() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="container py-12">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (user && isAdmin) return <Admin />;
  if (user && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <AdminSignIn />;
}

function AdminSignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | undefined>();

  const showDemo =
    import.meta.env.DEV ||
    String(import.meta.env.VITE_ENABLE_DEMO_LOGINS ?? "").toLowerCase() === "true";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(undefined);
    setFieldErrors({});

    if (!isSharedAdminPassword(password)) {
      setFormError("Incorrect admin credentials.");
      return;
    }

    setBusy(true);
    try {
      const gate = resolveAdminGateLogin(email, password, "owanbe");
      if (!gate.ok) {
        if (gate.status === "pending") void submitAccessRequest(email);
        setFormError(gate.message || AWAITING_MSG);
        return;
      }
      beginAdminGateAttempt();
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const mapped = mapAuthError(error);
          setFieldErrors(mapped.fields);
          setFormError(mapped.form);
          return;
        }
      } finally {
        endAdminGateAttempt();
      }
      toast.success("Welcome back!");
    } catch (err) {
      const mapped = mapAuthError(err);
      setFieldErrors(mapped.fields);
      setFormError(mapped.form ?? "Unexpected error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const enterDemoAdmin = async () => {
    if (demoBusy) return;
    setDemoBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_ADMIN.email,
        password: DEMO_PASSWORD,
      });
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
            email: DEMO_ADMIN.email,
            password: DEMO_PASSWORD,
            options: { emailRedirectTo: window.location.origin, data: { full_name: DEMO_ADMIN.name } },
          });
          if (signUpErr && !/already/i.test(signUpErr.message ?? "")) throw signUpErr;
          const retry = await supabase.auth.signInWithPassword({ email: DEMO_ADMIN.email, password: DEMO_PASSWORD });
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }
      const { error: roleErr } = await supabase.rpc("ensure_demo_role", { _role: "admin" });
      if (roleErr) {
        console.warn("[demo] ensure_demo_role", roleErr.message);
        toast.success("Signed in as demo admin (role grant skipped — apply migrations)");
      } else {
        toast.success("Signed in as demo admin");
      }
      navigate("/admin", { replace: true });
    } catch (err) {
      const mapped = mapAuthError(err);
      toast.error(mapped.form ?? mapped.fields.email ?? mapped.fields.password ?? "Couldn't sign in as demo admin");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="container max-w-sm py-16">
      <div className="text-center mb-6 space-y-1">
        <h1 className="text-2xl font-semibold">Admin access</h1>
        <p className="text-sm text-muted-foreground">
          {isOwnerEmail(email) ? "Sign in with your owner account." : "Sign in to manage OwanbeX."}
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {(formError || fieldErrors.email || fieldErrors.password) && (
          <p className="text-sm text-destructive">{formError || fieldErrors.email || fieldErrors.password}</p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter"}
        </Button>
      </form>

      {showDemo && (
        <div className="mt-6 pt-6 border-t space-y-2">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-neutral-400">
            Tester access
          </p>
          <Button type="button" variant="outline" className="w-full" disabled={demoBusy} onClick={enterDemoAdmin}>
            {demoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Demo admin"}
          </Button>
          <p className="text-center text-[11px] text-neutral-400">
            One-tap demo login · remove before production
          </p>
        </div>
      )}
    </div>
  );
}
