import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Check, RefreshCw, Undo2, UserCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  OWNER_EMAIL,
  OWNER_QUEUE_HINT,
  approveAdmin,
  listApprovedAdmins,
  listPendingQueue,
  mergeServerQueue,
  revokeAdmin,
} from "@/lib/adminTesterApproval";
import {
  EMPTY_QUEUE,
  decideAccessRequest,
  fetchAccessQueue,
  type AccessQueue,
} from "@/lib/adminAccessRequests";
import { publicError } from "@/lib/publicMessage";

/** How often the queue re-reads the server while the owner has the panel open. */
const POLL_MS = 30_000;

type Source = "loading" | "server" | "local-only";

export function AdminTesterQueue() {
  const { user, isFoundingOwner } = useAuth();
  const actor = user?.email ?? "";
  const isOwner = isFoundingOwner || actor.toLowerCase() === OWNER_EMAIL;

  const [queue, setQueue] = useState<AccessQueue>(EMPTY_QUEUE);
  const [source, setSource] = useState<Source>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);

  /** Server is authoritative; the local mirror only fills in while it is unreachable. */
  const load = useCallback(async (opts: { spinner?: boolean } = {}) => {
    if (opts.spinner) setRefreshing(true);
    const result = await fetchAccessQueue();
    if (result.ok) {
      mergeServerQueue(result.queue);
      setQueue(result.queue);
      setSource("server");
    } else {
      setQueue({
        pending: listPendingQueue("owanbe").map((p) => ({
          email: p.email,
          identity: p.identity,
          requested_at: p.requestedAt,
        })),
        approved: listApprovedAdmins().map((a) => ({ email: a.email, decided_at: a.approvedAt })),
        revoked: [],
      });
      setSource("local-only");
    }
    if (opts.spinner) setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    void load();
    const timer = window.setInterval(() => { void load(); }, POLL_MS);
    // A request raised in another tab of this browser should not need a reload.
    const onStorage = () => { void load(); };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, [isOwner, load]);

  if (!isOwner) return null;

  const decide = async (email: string, decision: "approve" | "reject") => {
    setBusyEmail(email);
    const result = await decideAccessRequest(email, decision);
    // Always mirror locally so the sign-in gate on this browser agrees, even
    // when the server call could not be made.
    if (decision === "approve") approveAdmin(actor, email);
    else revokeAdmin(actor, email);

    if (result.serverApplied) {
      toast.success(decision === "approve" ? `${email} approved` : `${email} rejected`);
    } else {
      toast.error(
        publicError(
          result.message,
          "We saved that decision on this device but couldn't sync it. Try again once you're signed in with your Owanbe account.",
        ),
      );
    }
    await load();
    setBusyEmail(null);
  };

  return (
    <Card id="admintester-queue" className="border-amber-200 scroll-mt-24">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-amber-600" aria-hidden />
            Admin access requests
            {queue.pending.length > 0 && (
              <Badge variant="secondary" className="ml-1">{queue.pending.length} waiting</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{OWNER_QUEUE_HINT}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load({ spinner: true })}
          disabled={refreshing}
          className="shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-2 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {source === "local-only" && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Showing requests saved on this device only. Sign in with your Owanbe account password
              to see requests from every device and to make approvals stick.
            </span>
          </p>
        )}

        {source === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : queue.pending.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-muted-foreground">
            No one is waiting for access right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.pending.map((p) => (
              <li
                key={p.email}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.identity || p.email}</p>
                  {p.requested_at && (
                    <p className="text-xs text-muted-foreground">
                      Asked {new Date(p.requested_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={busyEmail === p.email}
                    onClick={() => void decide(p.email, "approve")}
                  >
                    <Check className="h-3.5 w-3.5 mr-1.5" aria-hidden /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyEmail === p.email}
                    onClick={() => void decide(p.email, "reject")}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" aria-hidden /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {queue.approved.length > 0 && (
          <div className="border-t pt-3">
            <p className="mb-2 font-medium">Approved</p>
            <ul className="space-y-1">
              {queue.approved.map((a) => (
                <li key={a.email} className="flex items-center justify-between gap-3 py-1">
                  <span className="truncate">{a.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyEmail === a.email}
                    onClick={() => void decide(a.email, "reject")}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {queue.revoked.length > 0 && (
          <div className="border-t pt-3">
            <p className="mb-2 font-medium">Rejected</p>
            <ul className="space-y-1">
              {queue.revoked.map((r) => (
                <li key={r.email} className="flex items-center justify-between gap-3 py-1">
                  <span className="truncate text-muted-foreground">{r.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyEmail === r.email}
                    onClick={() => void decide(r.email, "approve")}
                  >
                    <Undo2 className="h-3.5 w-3.5 mr-1.5" aria-hidden /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
