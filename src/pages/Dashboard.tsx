import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Calendar, MapPin, Users, Sparkles, Wand2, Loader2, Building2 } from "lucide-react";
import { formatNairaCompact } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { GateGuard } from "@/components/GateGuard";
import { createSampleEvent } from "@/lib/sample-event";
import { useNavigate } from "react-router-dom";
import { ClaimSuperAdminCard } from "@/components/ClaimSuperAdminCard";

function DashboardInner() {
  const { user, isSuperAdmin, isFoundingOwner, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<import("@/integrations/supabase/types").Database["public"]["Tables"]["events"]["Row"][]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSuper, setHasSuper] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase.from("events").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
        setEvents(data ?? []);
      } catch (err) {
        console.warn("[dashboard] events unavailable", err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();

    // Check if any super_admin exists for bootstrap CTA
    (async () => {
      try {
        const { count } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "super_admin");
        setHasSuper((count ?? 0) > 0);
      } catch {
        setHasSuper(false);
      }
    })();
  }, [user]);

  const handleClaimed = async () => {
    try {
      await supabase.rpc("ensure_session_access");
    } catch {
      /* roles already refreshed via claim_super_admin */
    }
    await refreshRoles();
    setHasSuper(true);
    toast.success("You are now the super admin");
  };

  const trySample = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const res = await createSampleEvent(user.id);
      toast.success("Sample event created", { description: `${res.tiers} tiers • ${res.items} budget items` });
      navigate(`/events/${res.eventId}`);
    } catch (e) {
      toast.error("Could not create sample event", { description: e?.message });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <AppShell>
      <div className="container py-8 sm:py-12 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">My Events</h1>
            <p className="text-muted-foreground mt-1">Plan, customize and bring your celebrations to life.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={trySample} disabled={seeding} variant="outline" size="lg">
              {seeding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Try Sample Event
            </Button>
            <Button asChild size="lg" className="bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold">
              <Link to="/events/new"><Plus className="w-4 h-4 mr-2" /> New event</Link>
            </Button>
          </div>
        </div>

        {/* Bootstrap super admin — founding owner only */}
        {hasSuper === false && !isSuperAdmin && isFoundingOwner && (
          <ClaimSuperAdminCard onClaimed={handleClaimed} />
        )}

        {/* Become a brand */}
        <Card className="p-5 border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-gold flex items-center justify-center shrink-0 shadow-gold">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold">Are you a vendor or brand?</div>
            <p className="text-sm text-muted-foreground">List on Owanbe Planner from ₦100,000/month or ₦1M/year. Get analytics, leads and reach.</p>
          </div>
          <Button asChild className="bg-gradient-gold text-primary-foreground hover:opacity-90">
            <Link to="/brand/onboarding"><Building2 className="w-4 h-4 mr-2" /> Become a brand</Link>
          </Button>
        </Card>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EventCard({ ev }: { ev: import("@/integrations/supabase/types").Database["public"]["Tables"]["events"]["Row"] }) {
  return (
    <Link to={`/events/${ev.id}`}>
      <Card className="overflow-hidden group hover:shadow-elegant hover:border-primary/40 transition-all hover:-translate-y-1">
        <div className="relative h-32 bg-gradient-luxe overflow-hidden">
          <div className="absolute inset-0 ankara-divider opacity-20" />
          <div className="absolute inset-0 flex items-end p-4">
            <div className="font-display text-2xl font-bold text-white capitalize truncate">{ev.name}</div>
          </div>
        </div>
        <div className="p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground capitalize"><Sparkles className="w-4 h-4 text-primary" /> {ev.type}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {ev.city}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><Users className="w-4 h-4" /> {ev.guest_count} guests</div>
          {ev.event_date && <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> {new Date(ev.event_date).toLocaleDateString()}</div>}
          <div className="pt-2 text-foreground font-medium">{formatNairaCompact(ev.budget_min)} – {formatNairaCompact(ev.budget_max)}</div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 text-center border-dashed">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-gold flex items-center justify-center mb-4 shadow-gold">
        <Sparkles className="w-8 h-8 text-primary-foreground" />
      </div>
      <h3 className="font-display text-2xl font-bold">Start your first Owanbe</h3>
      <p className="text-muted-foreground mt-2 max-w-md mx-auto">Tell us about your celebration and our AI will craft three beautiful budget tiers for you in seconds.</p>
      <p className="text-muted-foreground text-sm mt-3 max-w-md mx-auto">Or click <strong>Try Sample Event</strong> above to instantly generate a fully-loaded demo with Gold, Platinum & Diamond tiers.</p>
      <Button asChild size="lg" className="mt-6 bg-gradient-gold text-primary-foreground hover:opacity-90 shadow-gold">
        <Link to="/events/new"><Plus className="w-4 h-4 mr-2" /> Create event</Link>
      </Button>
    </Card>
  );
}

export default function Dashboard() {
  return (
    <GateGuard service="registration" featureName="Account registration">
      <DashboardInner />
    </GateGuard>
  );
}
