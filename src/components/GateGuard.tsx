import { type ReactNode, useState } from "react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServiceGate, type ServiceKey } from "@/lib/service-gates";

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
  const { loading, blocked, gate } = useServiceGate(service, eventId);
  const [paying, setPaying] = useState(false);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
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
          description: resp?.error ?? "No payment provider is configured yet. Contact support to unlock this service.",
        });
      } else {
        window.location.href = resp.checkoutUrl;
      }
    } catch (e) {
      toast.error("Could not start checkout", { description: String((e as { message?: string })?.message ?? e) });
    }
    setPaying(false);
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
          <p className="text-xs text-muted-foreground">
            Already paid? Refresh this page after checkout completes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
