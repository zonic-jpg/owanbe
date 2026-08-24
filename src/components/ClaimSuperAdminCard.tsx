import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ShieldAlert, Loader2, CheckCircle2, AlertTriangle, Crown,
  Lock, ShieldCheck, X,
} from "lucide-react";

type Status = "idle" | "claiming" | "success" | "error";

interface Props {
  /** Called after a successful claim to refresh parent state. */
  onClaimed: () => void | Promise<void>;
}

export function ClaimSuperAdminCard({ onClaimed }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function reset() {
    setConfirmed(false);
    setStatus("idle");
    setErrorMsg(null);
  }

  async function handleClaim() {
    if (!confirmed || status === "claiming") return;
    setStatus("claiming");
    setErrorMsg(null);

    const { error } = await supabase.rpc("claim_super_admin");

    if (error) {
      setStatus("error");
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already")) {
        setErrorMsg(
          "A super admin already exists for this workspace. Ask them to grant you admin from the Roles tab."
        );
      } else if (msg.includes("designated owner") || msg.includes("oadeagbo@gmail.com")) {
        setErrorMsg("Only oadeagbo@gmail.com can claim super admin for this workspace.");
      } else if (msg.includes("not authenticated") || msg.includes("auth")) {
        setErrorMsg("Your session expired. Please sign out and sign in again, then retry.");
      } else {
        setErrorMsg(error.message || "Something went wrong. Try again in a moment.");
      }
      return;
    }

    setStatus("success");
    await onClaimed();
  }

  function handleClose(next: boolean) {
    if (status === "claiming") return; // prevent closing mid-call
    setOpen(next);
    if (!next) setTimeout(reset, 200);
  }

  return (
    <>
      <Card className="p-5 border-primary/40 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-up">
        <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shrink-0 shadow-gold">
          <Crown className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">Claim super admin</span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
              Founding owner
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as the designated owner ({user?.email}). Claim super admin to
            manage vendors, content, and admin permissions.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-gradient-gold text-primary-foreground hover:opacity-90"
        >
          <Crown className="w-4 h-4 mr-2" />
          Claim super admin
        </Button>
      </Card>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          {status !== "success" ? (
            <>
              <DialogHeader>
                <div className="mx-auto w-14 h-14 rounded-full bg-gradient-gold flex items-center justify-center mb-3 shadow-gold">
                  <Crown className="w-7 h-7 text-primary-foreground" />
                </div>
                <DialogTitle className="text-center text-2xl">
                  Become the super admin
                </DialogTitle>
                <DialogDescription className="text-center">
                  This grants <strong>super admin</strong> to the founding owner account
                  (<strong>oadeagbo@gmail.com</strong>) for this workspace.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <PermissionRow
                  icon={ShieldCheck}
                  title="Full admin powers"
                  body="Manage vendors, sponsors, pricing rules and tiers."
                />
                <PermissionRow
                  icon={Crown}
                  title="Grant & revoke admins"
                  body="Promote others to admin or super admin via the Roles tab."
                />
                <PermissionRow
                  icon={Lock}
                  title="Self-revoke is blocked"
                  body="You cannot remove your own super admin role for safety."
                />
              </div>

              {status === "error" && errorMsg && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Couldn't claim super admin</AlertTitle>
                  <AlertDescription>{errorMsg}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
                <Checkbox
                  id="confirm-super"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(Boolean(v))}
                  disabled={status === "claiming"}
                />
                <Label
                  htmlFor="confirm-super"
                  className="text-sm font-normal leading-relaxed cursor-pointer"
                >
                  I understand this action is permanent and that I'll be responsible
                  for all admin operations on{" "}
                  <span className="font-medium">{user?.email}</span>.
                </Label>
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  variant="ghost"
                  onClick={() => handleClose(false)}
                  disabled={status === "claiming"}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleClaim}
                  disabled={!confirmed || status === "claiming"}
                  className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                >
                  {status === "claiming" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Claiming…
                    </>
                  ) : status === "error" ? (
                    <>
                      <ShieldAlert className="w-4 h-4 mr-2" />
                      Try again
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      Confirm & claim
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="text-center py-4 space-y-4 animate-fade-up">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-center text-2xl">
                  You're now the super admin 👑
                </DialogTitle>
                <DialogDescription className="text-center">
                  Head to the admin panel to manage vendors, content and grant
                  roles to other users.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  <X className="w-4 h-4 mr-2" /> Close
                </Button>
                <Button
                  asChild
                  className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                >
                  <a href="/admin">Open admin panel</a>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PermissionRow({
  icon: Icon, title, body,
}: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="text-sm">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}
