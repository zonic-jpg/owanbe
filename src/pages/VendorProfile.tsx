import { useEffect, useState } from "react";
import { track as zonicTrack } from "@/lib/zonic-track";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Star, MapPin, Mail, Phone, MessageCircle, BadgeCheck, Sparkles,
  ArrowLeft, Heart,
} from "lucide-react";
import { tintFor } from "@/lib/vendor-covers";
import { CoverImage } from "@/components/CoverImage";
import { ShortlistButton } from "@/components/ShortlistButton";
import { trackVendorEvent } from "@/lib/analytics-track";

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
  is_approved: boolean;
  availability: unknown;
};

type PortfolioItem = {
  id: string;
  image_url: string;
  caption: string | null;
  position: number;
};

type Review = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  author_id: string | null;
};

const bandLabel: Record<string, string> = {
  affordable: "₦ Affordable",
  mid: "₦₦ Mid-range",
  premium: "₦₦₦ Premium",
  luxury: "₦₦₦₦ Luxury",
};

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rated ${value.toFixed(1)} of 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            size={size}
            className={filled ? "fill-primary text-primary" : "text-muted-foreground/40"}
          />
        );
      })}
    </div>
  );
}

export default function VendorProfile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [shortlisting, setShortlisting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: v }, { data: p }, { data: r }] = await Promise.all([
        supabase.from("vendors").select("*").eq("id", id).maybeSingle(),
        supabase.from("vendor_portfolio").select("*").eq("vendor_id", id).order("position"),
        supabase.from("vendor_reviews").select("*").eq("vendor_id", id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setVendor(v as Vendor | null);
      setPortfolio((p ?? []) as PortfolioItem[]);
      setReviews((r ?? []) as Review[]);
      setLoading(false);
      if (v) trackVendorEvent((v as Vendor).id, "view");
      if (v) zonicTrack("view", { entity: { type: "vendor", id: (v as Vendor).id, category: (v as Vendor).category } });
    })();
    return () => { cancelled = true; };
  }, [id]);

  const ratingAvg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : vendor?.rating ?? 0;

  const ratingDist = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));

  async function addToShortlist() {
    if (!user) {
      toast.error("Please sign in to shortlist vendors");
      return;
    }
    setShortlisting(true);
    const { data: events } = await supabase
      .from("events")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const eventId = events?.[0]?.id;
    if (!eventId) {
      toast.error("Create an event first to start a shortlist");
      setShortlisting(false);
      return;
    }
    const { error } = await supabase
      .from("shortlists")
      .insert({ event_id: eventId, vendor_id: id! });
    if (error) {
      if (error.code === "23505") toast.info("Already in your shortlist");
      else toast.error(error.message);
    } else {
      toast.success(`Added to "${events![0].name}" shortlist`);
    }
    setShortlisting(false);
  }

  if (loading) {
    return (
      <AppShell>
        <div className="container max-w-6xl py-8 space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!vendor) {
    return (
      <AppShell>
        <div className="container max-w-2xl py-16 text-center space-y-4">
          <h1 className="text-2xl font-semibold">Vendor not found</h1>
          <p className="text-muted-foreground">This vendor may have been removed or is not yet approved.</p>
          <Button asChild><Link to="/vendors">Back to vendors</Link></Button>
        </div>
      </AppShell>
    );
  }

  const initials = vendor.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <AppShell>
      <div className="container max-w-6xl py-6 space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/vendors"><ArrowLeft className="mr-1 h-4 w-4" /> Back to vendors</Link>
        </Button>

        {/* Hero */}
        {(() => {
          const hasRealCover = !!(vendor.cover_url && vendor.cover_url.trim().length > 0);
          const tint = tintFor(vendor.id);
          return (
            <div className="relative overflow-hidden rounded-2xl border bg-card">
              <CoverImage
                category={vendor.category}
                coverUrl={vendor.cover_url}
                vendorId={vendor.id}
                alt={`${vendor.name} cover`}
                loading="eager"
                className="h-48 md:h-64 w-full object-cover object-center"
              />
              {!hasRealCover && (
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-48 md:h-64 pointer-events-none mix-blend-soft-light"
                  style={{ background: tint.overlay }}
                />
              )}
          <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-end gap-6 md:-mt-16">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-4 border-background shadow-lg">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">{vendor.name}</h1>
                {vendor.is_sponsored && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                    <Sparkles className="mr-1 h-3 w-3" /> Sponsored
                  </Badge>
                )}
                {vendor.is_approved && (
                  <Badge variant="outline" className="gap-1">
                    <BadgeCheck className="h-3 w-3 text-primary" /> Verified
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="capitalize font-medium text-foreground">{vendor.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{vendor.city}</span>
                <span>•</span>
                <span>{bandLabel[vendor.price_band] ?? vendor.price_band}</span>
              </div>
              <div className="flex items-center gap-2">
                <Stars value={ratingAvg} />
                <span className="font-semibold">{ratingAvg.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <ShortlistButton vendorId={vendor.id} vendorName={vendor.name} variant="full" />
            </div>
          </div>
        </div>
          );
        })()}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <Card>
              <CardHeader><CardTitle>About</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {vendor.bio || "This vendor hasn't added a bio yet."}
                </p>
              </CardContent>
            </Card>

            {/* Portfolio */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio {portfolio.length > 0 && <span className="text-muted-foreground font-normal">({portfolio.length})</span>}</CardTitle>
              </CardHeader>
              <CardContent>
                {portfolio.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No portfolio images yet.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {portfolio.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setLightbox(item.image_url)}
                        className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
                      >
                        <img
                          src={item.image_url}
                          alt={item.caption ?? `${vendor.name} portfolio`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {item.caption && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.caption}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="text-center md:border-r md:pr-6">
                    <div className="text-4xl font-bold">{ratingAvg.toFixed(1)}</div>
                    <Stars value={ratingAvg} size={18} />
                    <div className="text-xs text-muted-foreground mt-1">
                      {reviews.length} review{reviews.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex-1 w-full space-y-1.5">
                    {ratingDist.map(({ stars, count }) => {
                      const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-2 text-xs">
                          <span className="w-3 text-muted-foreground">{stars}</span>
                          <Star className="h-3 w-3 fill-primary text-primary" />
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-muted-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* List */}
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No reviews yet. Be the first to leave one.
                  </p>
                ) : (
                  <ul className="space-y-5">
                    {reviews.map((r) => (
                      <li key={r.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {(r.author_id ?? "A").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">Verified guest</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleDateString("en-NG", {
                                  year: "numeric", month: "short", day: "numeric",
                                })}
                              </div>
                            </div>
                          </div>
                          <Stars value={r.rating} />
                        </div>
                        {r.body && <p className="text-sm text-muted-foreground pl-10">{r.body}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {vendor.contact_email && (
                  <a href={`mailto:${vendor.contact_email}`} onClick={() => trackVendorEvent(vendor.id, "contact_email")} className="flex items-center gap-3 text-sm hover:text-primary">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{vendor.contact_email}</span>
                  </a>
                )}
                {vendor.contact_phone && (
                  <a href={`tel:${vendor.contact_phone}`} onClick={() => trackVendorEvent(vendor.id, "contact_phone")} className="flex items-center gap-3 text-sm hover:text-primary">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{vendor.contact_phone}</span>
                  </a>
                )}
                {vendor.whatsapp && (
                  <a
                    href={`https://wa.me/${vendor.whatsapp.replace(/\D/g, "")}`}
                    target="_blank" rel="noreferrer"
                    onClick={() => trackVendorEvent(vendor.id, "contact_whatsapp")}
                    className="flex items-center gap-3 text-sm hover:text-primary"
                  >
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span>WhatsApp: {vendor.whatsapp}</span>
                  </a>
                )}
                {!vendor.contact_email && !vendor.contact_phone && !vendor.whatsapp && (
                  <p className="text-sm text-muted-foreground">No public contact details.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
              <CardContent>
                {Array.isArray(vendor.availability) && vendor.availability.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {(vendor.availability as Array<Record<string, unknown>>).slice(0, 8).map((slot, i) => (
                      <li key={i} className="flex items-center justify-between border-b last:border-0 pb-1.5">
                        <span>{typeof slot === "string" ? slot : slot.date ?? JSON.stringify(slot)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {typeof slot === "object" && slot.status ? slot.status : "Open"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Contact vendor for availability.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Portfolio detail" className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </AppShell>
  );
}
