import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { publicError } from "@/lib/publicMessage";

/**
 * Forgot-password and reset-password dialogs.
 *
 * Built on the shared Dialog rather than a hand-rolled fixed overlay so it
 * inherits Escape-to-close, the focus trap, focus restore on close, scroll
 * lock and the dialog aria roles — none of which the previous inline-styled
 * version had. It also means the card follows the app's own light/dark
 * tokens instead of hardcoded white with a hardcoded pink button.
 */
export function PasswordRecovery() {
  const [mode, setMode] = useState<"forgot" | "reset" | null>(null);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const open = () => {
      if (location.hash.replace(/^#/, "") === "forgot") setMode("forgot");
    };
    open();
    window.addEventListener("hashchange", open);
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => {
      window.removeEventListener("hashchange", open);
      sub.subscription.unsubscribe();
    };
  }, []);

  const close = () => {
    setMode(null);
    setSentTo(null);
    setDone(false);
    setErr(null);
    setPw("");
    setPw2("");
    if (location.hash.includes("forgot")) {
      // Clear the hash without adding a history entry the Back button lands on.
      history.replaceState(null, "", location.pathname + location.search);
    }
  };

  const sendReset = async () => {
    const target = email.trim();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      // No extra fragment here: Supabase appends its own recovery parameters
      // to this URL, and a hash we add first can collide with them.
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) {
      setErr(publicError(error, "We couldn't send that reset link. Please try again in a moment."));
      return;
    }
    setSentTo(target);
  };

  const doReset = async () => {
    if (pw.length < 8) return setErr("Use at least 8 characters.");
    if (pw !== pw2) return setErr("Those two passwords don't match.");
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr(publicError(error, "We couldn't update your password. Please request a fresh reset link."));
      return;
    }
    setDone(true);
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        {mode === "reset" ? (
          <>
            <DialogHeader>
              <DialogTitle>{done ? "Password updated" : "Set a new password"}</DialogTitle>
              <DialogDescription>
                {done
                  ? "You're all set — your new password is active."
                  : "Choose a password you haven't used on Owanbe before."}
              </DialogDescription>
            </DialogHeader>

            {done ? (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                <p className="text-sm">You can now sign in with your new password.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pr-new">New password</Label>
                  <Input
                    id="pr-new"
                    type="password"
                    autoComplete="new-password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pr-confirm">Confirm password</Label>
                  <Input
                    id="pr-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !busy && doReset()}
                    placeholder="Type it again"
                  />
                </div>
                {err && (
                  <p role="alert" className="text-sm text-destructive">{err}</p>
                )}
              </div>
            )}

            <DialogFooter>
              {done ? (
                <Button onClick={close} className="w-full sm:w-auto">Done</Button>
              ) : (
                <Button onClick={doReset} disabled={busy} className="w-full sm:w-auto">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  Update password
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{sentTo ? "Check your inbox" : "Reset your password"}</DialogTitle>
              <DialogDescription>
                {sentTo
                  ? "The link is valid for one hour. If it expires, just ask for another."
                  : "We'll email you a link to choose a new password."}
              </DialogDescription>
            </DialogHeader>

            {sentTo ? (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 space-y-1 text-sm">
                  <p>
                    If an Owanbe account uses <span className="font-medium break-all">{sentTo}</span>,
                    a reset link is on its way.
                  </p>
                  <p className="text-muted-foreground">
                    Nothing after a few minutes? Check your spam folder, then try again.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pr-email">Email address</Label>
                  <Input
                    id="pr-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && email.includes("@") && !busy && sendReset()}
                    placeholder="you@example.com"
                  />
                </div>
                {err && (
                  <p role="alert" className="text-sm text-destructive">{err}</p>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              {sentTo ? (
                <>
                  <Button variant="outline" onClick={() => setSentTo(null)} className="w-full sm:w-auto">
                    Use a different email
                  </Button>
                  <Button onClick={close} className="w-full sm:w-auto">Done</Button>
                </>
              ) : (
                <Button
                  onClick={sendReset}
                  disabled={busy || !email.includes("@")}
                  className="w-full sm:w-auto"
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  Send reset link
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
