import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServiceGate, type ServiceKey } from "@/lib/service-gates";
import { publicError } from "@/lib/publicMessage";

const MODEL_LABEL: Record<string, string> = {
  one_off: "one-time", per_event: "per event", subscription: "subscription",
};

/** Wraps a feature. If the super admin has enabled a payment gate for the
 *  service and this user hasn't paid, shows a graceful upgrade prompt with
 *  live checkout (Flutterwave/Paystack via the zonicme-payment function).
 *  Gate off, or already paid -> renders children untouched. */
export function GateGuard({ service, eventId, featureName, children }: {
  service: ServiceKey; eventId?: string | null; featureName: string; children: ReactNode;
}) {
  const location = useLocation();
  const { loading, blocked, gate, needsSignIn, refresh } = useServiceGate(service, eventId);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  // On return from the payment gateway (…?svcpay=<reference>), confirm the
  // charge server-side (the edge function writes the service_payments row),
  // then reload so the gate re-checks and unlocks. The client never records
  // the payment itself.
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("svcpay");
    if (!ref) return;
    let cancelled = false;
    (async () => {
      setVerifying(true);
      try {
        const { data, error } = await supabase.functions.invoke("zonicme-payment", {
          body: { action: "verify", reference: ref },
        });
        const resp = (data ?? {}) as { ok?: boolean; error?: string };
        if (error || !resp.ok) {
          toast.error("Payment not confirmed", {
            description: publicError(
              resp?.error ?? error,
              "We couldn't confirm that payment. If you were charged, contact support and we'll sort it out.",
            ),
          });
        } else {
          toast.success("Service unlocked", {
            description: `Payment confirmed at ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}.`,
          });
        }
      } catch (e) {
        toast.error("Payment not confirmed", {
          description: publicError(e, "We couldn't confirm that payment. If you were charged, contact support."),
        });
      } finally {
        url.searchParams.delete("svcpay");
        const clean = url.pathname + url.search + url.hash;
        // Brief delay lets the toast render before we reload to re-check the gate.
        window.setTimeout(() => { if (!cancelled) window.location.replace(clean); }, 900);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // A bare spinner after returning from a payment provider reads as a hang.
  if (verifying) {
    return (
      <div className="container max-w-sm py-20 text-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" aria-hidden />
        <p className="font-medium">Confirming your payment…</p>
        <p className="text-sm text-muted-foreground">
          Don't close this page. We're checking with your payment provider.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container max-w-sm py-20 text-center space-y-3" aria-busy="true">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" aria-hidden />
        <p className="text-sm text-muted-foreground">Checking your access to {featureName.toLowerCase()}…</p>
      </div>
    );
  }

  // No session means every write behind this gate would be refused as anon.
  // Rendering the feature anyway is what produced raw "Unauthorized" popups
  // on the first save.
  if (needsSignIn) {
    return (
      <div className="container max-w-lg py-16">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground" aria-hidden />
            </div>
            <h2 className="text-xl font-bold">Sign in to use {featureName.toLowerCase()}</h2>
            <p className="text-sm text-muted-foreground">
              {featureName} is tied to your account, so we need to know who you are before we can save anything.
            </p>
            <Button asChild className="w-full">
              <Link to={`/auth?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!blocked) return <>{children}</>;

  const pay = async () => {
    setPaying(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("zonicme-payment", {
        body: {
          action: "initialize",
          plan: `service:${service}${eventId ? `:${eventId}` : ""}`,
          email: auth.user?.email,
          redirect_base: window.location.href.split("?")[0],
        },
      });
      if (error) throw error;
      const resp = data as { checkoutUrl?: string; error?: string };
      if (resp?.error || !resp?.checkoutUrl) {
        toast.error("Checkout unavailable", {
          description: publicError(
            resp?.error,
            "We can't start checkout right now. Please try again shortly, or contact support to unlock this service.",
          ),
        });
      } else {
        window.location.href = resp.checkoutUrl;
      }
    } catch (e) {
      toast.error("Could not start checkout", {
        description: publicError(e, "We can't start checkout right now. Please try again shortly."),
      });
    }
    setPaying(false);
  };

  const recheck = async () => {
    setRechecking(true);
    refresh();
    // The gate re-read is quick; the pause keeps the button from flickering.
    window.setTimeout(() => setRechecking(false), 600);
  };

  return (
    <div className="container max-w-lg py-16">
      <Card className="border-primary/30">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{featureName} is a premium service</h2>
          <p className="text-sm text-muted-foreground">
            Unlock {featureName.toLowerCase()} for{" "}
            <span className="font-semibold text-foreground">
              {gate?.currency ?? "NGN"} {Number(gate?.price ?? 0).toLocaleString()}
            </span>{" "}
            ({MODEL_LABEL[gate?.model ?? "one_off"]}). Pay securely with Flutterwave or Paystack.
          </p>
          <Button className="w-full" onClick={pay} disabled={paying}>
            {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Unlock now
          </Button>
          <Button variant="ghost" size="sm" onClick={recheck} disabled={rechecking} className="w-full">
            {rechecking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" aria-hidden /> : null}
            Already paid? Re-check my access
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
