import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useShortlist } from "@/contexts/ShortlistContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MapPin, X, Mail, Phone, MessageCircle, Heart } from "lucide-react";
import { coverFor } from "@/lib/vendor-covers";

type Vendor = {
  id: string;
  name: string;
  category: string;
  city: string;
  price_band: string;
  rating: number;
  cover_url: string | null;
  bio: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  is_sponsored: boolean;
};

const bandLabel: Record<string, string> = {
  affordable: "₦ Affordable",
  mid: "₦₦ Mid-range",
  premium: "₦₦₦ Premium",
  luxury: "₦₦₦₦ Luxury",
};

const prettyCategory = (c: string) =>
  c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

export default function Shortlist() {
  const { user } = useAuth();
  const { vendorIds, eventName, remove, clear, loading: ctxLoading } = useShortlist();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ids = Array.from(vendorIds);
      if (ids.length === 0) {
        setVendors([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("vendors")
        .select(
          "id,name,category,city,price_band,rating,cover_url,bio,contact_email,contact_phone,whatsapp,is_sponsored"
        )
        .in("id", ids);
      setVendors((data ?? []) as Vendor[]);
      setLoading(false);
    })();
  }, [vendorIds]);

  if (!user) {
    return (
      <AppShell>
        <div className="container max-w-2xl py-16 text-center space-y-4">
          <h1 className="text-2xl font-semibold">Sign in to view your shortlist</h1>
          <Button asChild><Link to="/auth">Sign in</Link></Button>
        </div>
      </AppShell>
    );
  }

  // Group by category for organised comparison
  const byCategory = vendors.reduce<Record<string, Vendor[]>>((acc, v) => {
    (acc[v.category] ??= []).push(v);
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Your shortlist</h1>
            <p className="text-muted-foreground mt-1">
              {eventName ? <>For <span className="font-medium text-foreground">{eventName}</span> · </> : null}
              {vendorIds.size} vendor{vendorIds.size === 1 ? "" : "s"} saved
            </p>
          </div>
          {vendors.length > 0 && (
            <Button variant="ghost" onClick={() => clear()}>Clear all</Button>
          )}
        </header>

        {loading || ctxLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <h2 className="text-xl font-semibold">Nothing shortlisted yet</h2>
              <p className="text-muted-foreground">
                Tap the heart on any vendor card to save them here. Add 3–5 vendors per category to compare side by side.
              </p>
              <Button asChild><Link to="/vendors">Browse vendors</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {Object.entries(byCategory)
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([cat, list]) => (
                <CategoryCompare
                  key={cat}
                  category={cat}
                  vendors={list}
                  onRemove={(id) => remove(id)}
                />
              ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CategoryCompare({
  category,
  vendors,
  onRemove,
}: {
  category: string;
  vendors: Vendor[];
  onRemove: (id: string) => void;
}) {
  const showing = vendors.slice(0, 5);
  return (
    <section>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-semibold">{prettyCategory(category)}</h2>
        <span className="text-sm text-muted-foreground">
          {vendors.length} saved {vendors.length > 5 && "· comparing first 5"}
        </span>
      </div>

      {/* Cards row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {showing.map((v) => (
          <div key={v.id} className="relative group">
            <button
              onClick={() => onRemove(v.id)}
              aria-label="Remove"
              className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-background/90 border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <Link to={`/vendors/${v.id}`}>
              <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={coverFor(v.category, v.cover_url)}
                    alt={v.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-1">{v.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {v.city}
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left p-3 font-medium text-muted-foreground w-32">Attribute</th>
              {showing.map((v) => (
                <th key={v.id} className="text-left p-3 font-semibold min-w-[160px]">
                  {v.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Rating" cells={showing.map((v) => (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {Number(v.rating).toFixed(1)}
              </span>
            ))} />
            <Row label="Price" cells={showing.map((v) => (
              <Badge variant="secondary">{bandLabel[v.price_band] ?? v.price_band}</Badge>
            ))} />
            <Row label="City" cells={showing.map((v) => v.city)} />
            <Row label="Featured" cells={showing.map((v) => v.is_sponsored ? "★ Yes" : "—")} />
            <Row label="Bio" cells={showing.map((v) => (
              <span className="text-muted-foreground line-clamp-3 block">{v.bio || "—"}</span>
            ))} />
            <Row label="Contact" cells={showing.map((v) => (
              <div className="space-y-1.5 text-xs">
                {v.contact_email && (
                  <a href={`mailto:${v.contact_email}`} className="flex items-center gap-1.5 hover:text-primary">
                    <Mail className="h-3 w-3" /><span className="truncate">{v.contact_email}</span>
                  </a>
                )}
                {v.contact_phone && (
                  <a href={`tel:${v.contact_phone}`} className="flex items-center gap-1.5 hover:text-primary">
                    <Phone className="h-3 w-3" />{v.contact_phone}
                  </a>
                )}
                {v.whatsapp && (
                  <a
                    href={`https://wa.me/${v.whatsapp.replace(/\D/g, "")}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-primary"
                  >
                    <MessageCircle className="h-3 w-3" />WhatsApp
                  </a>
                )}
                {!v.contact_email && !v.contact_phone && !v.whatsapp && (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            ))} />
            <Row label="" cells={showing.map((v) => (
              <Button asChild size="sm" variant="outline">
                <Link to={`/vendors/${v.id}`}>View profile</Link>
              </Button>
            ))} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ label, cells }: { label: string; cells: React.ReactNode[] }) {
  return (
    <tr className="border-b last:border-0 align-top">
      <td className="p-3 font-medium text-muted-foreground">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="p-3">{c}</td>
      ))}
    </tr>
  );
}
