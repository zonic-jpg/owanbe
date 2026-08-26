import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import {
  AWAITING_MSG,
  OWNER_EMAIL,
  approveAdmin,
  listApprovedAdmins,
  listPendingQueue,
  revokeAdmin,
} from "@/lib/adminTesterApproval";

export function AdminTesterQueue() {
  const { user, isFoundingOwner } = useAuth();
  const [tick, setTick] = useState(0);
  const actor = user?.email ?? "";
  const pending = listPendingQueue("owanbe");
  const approved = listApprovedAdmins();
  const bump = () => setTick((n) => n + 1);

  if (!isFoundingOwner && actor.toLowerCase() !== OWNER_EMAIL) return null;

  return (
    <Card id="admintester-queue" className="border-amber-200 scroll-mt-24" key={tick}>
      <CardHeader>
        <CardTitle className="text-lg">ADMINTESTER approvals</CardTitle>
        <p className="text-sm text-muted-foreground">{AWAITING_MSG}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {pending.length === 0 ? (
          <p className="text-muted-foreground">No pending requests.</p>
        ) : (
          pending.map((p) => (
            <div key={`${p.email}-${p.requestedAt}`} className="flex justify-between items-center gap-2">
              <div>
                <p className="font-medium">{p.identity || p.email}</p>
                <p className="text-xs text-muted-foreground">{new Date(p.requestedAt).toLocaleString()}</p>
              </div>
              <Button size="sm" onClick={() => { approveAdmin(actor, p.email); bump(); }}>
                Approve
              </Button>
            </div>
          ))
        )}
        {approved.length > 0 && (
          <div className="pt-2 border-t">
            <p className="font-medium mb-2">Approved</p>
            {approved.map((a) => (
              <div key={a.email} className="flex justify-between items-center py-1">
                <span>{a.email}</span>
                <Button variant="outline" size="sm" onClick={() => { revokeAdmin(actor, a.email); bump(); }}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
