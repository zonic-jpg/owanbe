import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Check, Sparkles, Trophy, Crown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { prettyCategory } from "@/lib/vendor-categories";
import { trackProductEvent } from "@/lib/catalog-track";
import { track as zonicTrack } from "@/lib/zonic-track";
import { CoverImage } from "@/components/CoverImage";

const fmt = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

type Product = {
  id: string;
  name: string;
  description: string | null;
  unit_label: string;
  unit_price: number;
  rating: number;
  is_featured: boolean;
  image_url: string | null;
  attributes: Record<string, unknown>;
  category: string;
  city: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: string | null;
  eventId: string;
  guestCount: number;
  currentSelectionId?: string | null;
  onPicked: () => void;
};

const qtyForUnit = (label: string, guests: number): number => {
  const l = label.toLowerCase();
  if (l.includes("guest")) return guests;
  if (l.includes("face")) return Math.max(6, Math.round(guests * 0.04));
  if (l.includes("chair")) return guests;
  if (l.includes("table")) return Math.ceil(guests / 10);
  if (l.includes("bottle")) return Math.max(12, Math.round(guests / 10));
  if (l.includes("crate")) return Math.max(2, Math.round(guests / 60));
  if (l.includes("bouquet")) return 1;
  if (l.includes("set")) return 1;
  if (l.includes("tray")) return Math.max(2, Math.round(guests / 50));
  if (l.includes("box")) return Math.max(2, Math.round(guests / 60));
  if (l.includes("bus")) return Math.max(1, Math.ceil(guests / 32));
  if (l.includes("yard")) return 4;
  if (l.includes("piece")) return 1;
  if (l.includes("pair")) return 1;
  if (l.includes("gele")) return Math.max(10, Math.round(guests * 0.15));
  if (l.includes("200")) return Math.max(1, Math.ceil(guests / 200));
  return 1;
};

export function CategoryBrowser({ open, onOpenChange, category, eventId, guestCount, currentSelectionId, onPicked }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(currentSelectionId ?? null);

  useEffect(() => { setSelectedId(currentSelectionId ?? null); }, [currentSelectionId, open]);

  useEffect(() => {
    if (!open || !category) return;
    setLoading(true); setSearch(""); setDetailProduct(null);
    (async () => {
      const { data } = await supabase
        .from("catalog_products")
        .select("*")
        .eq("category", category as import("@/integrations/supabase/types").Database["public"]["Tables"]["catalog_products"]["Row"]["category"])
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("rating", { ascending: false });
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
  }, [open, category]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  }, [products, search]);

  // Top 3 — one Editor's pick (featured/top-rated), one Best value (lowest subtotal), one Premium (highest subtotal).
  const top3 = useMemo(() => {
    if (products.length === 0) return [] as { product: Product; label: string; tone: "primary" | "emerald" | "amber"; qty: number; subtotal: number }[];
    const withSub = products.map((p) => {
      const qty = qtyForUnit(p.unit_label, guestCount);
      return { product: p, qty, subtotal: qty * p.unit_price };
    });
    const editor = [...withSub].sort((a, b) => (Number(b.product.is_featured) - Number(a.product.is_featured)) || b.product.rating - a.product.rating)[0];
    const value = [...withSub].filter((x) => x.product.id !== editor.product.id).sort((a, b) => a.subtotal - b.subtotal)[0];
    const premium = [...withSub].filter((x) => x.product.id !== editor.product.id && x.product.id !== value?.product.id).sort((a, b) => b.subtotal - a.subtotal)[0];
    return [
      { ...editor, label: "Editor's pick", tone: "primary" as const },
      ...(value ? [{ ...value, label: "Best value", tone: "emerald" as const }] : []),
      ...(premium ? [{ ...premium, label: "Premium", tone: "amber" as const }] : []),
    ];
  }, [products, guestCount]);

  const pickProduct = async (product: Product, opts: { closeAfter?: boolean } = {}) => {
    if (!eventId) return;
    setPicking(product.id);
    const prevId = selectedId;
    setSelectedId(product.id); // optimistic
    const qty = qtyForUnit(product.unit_label, guestCount);
    const payload = {
      event_id: eventId,
      category: product.category as import("@/integrations/supabase/types").Database["public"]["Tables"]["catalog_products"]["Row"]["category"],
      product_id: product.id,
      qty,
      locked_unit_price: product.unit_price,
    };
    const { error } = await supabase.from("event_selections").upsert(payload, { onConflict: "event_id,category" });
    setPicking(null);
    if (error) {
      setSelectedId(prevId);
      return toast.error(error.message);
    }
    trackProductEvent(product.id, "select", eventId);
    zonicTrack("event.product.selected", {
      entity: { type: "catalog_product", id: product.id, category: product.category },
      properties: { event_id: eventId, qty, unit_price: product.unit_price },
    });
    toast.success(`${product.name} selected · totals updated`);
    onPicked();
    if (opts.closeAfter) {
      setDetailProduct(null);
      onOpenChange(false);
    }
  };

  const openDetail = (p: Product) => {
    setDetailProduct(p);
    trackProductEvent(p.id, "click", eventId);
  };

  const toneClass = (tone: "primary" | "emerald" | "amber") =>
    tone === "primary" ? "bg-primary/10 text-primary border-primary/20"
    : tone === "emerald" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {category ? prettyCategory(category) : ""}
            </SheetTitle>
            <p className="text-sm text-muted-foreground text-left">{products.length} options in your city. Tap any card for details.</p>
          </SheetHeader>

          {loading ? (
            <div className="space-y-3 mt-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : (
            <div className="space-y-6 mt-4">
              {top3.length >= 2 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /><h3 className="font-display text-lg">Top 3 picks</h3></div>
                    <span className="text-xs text-muted-foreground">For {guestCount} guests</span>
                  </div>
                  <Card className="overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="p-2 font-medium w-10">#</th>
                          <th className="p-2 font-medium">Pick</th>
                          <th className="p-2 font-medium hidden sm:table-cell">Rating</th>
                          <th className="p-2 font-medium text-right">Subtotal</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {top3.map((row, i) => {
                          const p = row.product;
                          const isSelected = selectedId === p.id;
                          return (
                            <tr key={p.id} className={`border-t transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                              <td className="p-2 align-top">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-display">
                                  {i === 0 ? <Crown className="w-3.5 h-3.5 text-primary" /> : i + 1}
                                </div>
                              </td>
                              <td className="p-2">
                                <div className="flex gap-2 items-start">
                                  <CoverImage
                                    category={p.category}
                                    coverUrl={p.image_url}
                                    vendorId={p.id}
                                    alt={p.name}
                                    className="w-10 h-10 rounded object-cover flex-shrink-0 hidden sm:block"
                                  />
                                  <div className="min-w-0">
                                    <button onClick={() => openDetail(p)} className="text-left hover:underline font-medium block truncate max-w-[180px]">{p.name}</button>
                                    <Badge variant="outline" className={`mt-1 text-[10px] ${toneClass(row.tone)}`}>{row.label}</Badge>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2 hidden sm:table-cell"><span className="inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-primary text-primary" />{p.rating}</span></td>
                              <td className="p-2 text-right whitespace-nowrap">
                                <div className="font-medium">{fmt(row.subtotal)}</div>
                                <div className="text-[11px] text-muted-foreground">{row.qty} × {fmt(p.unit_price)}</div>
                              </td>
                              <td className="p-2 text-right">
                                {isSelected ? (
                                  <Badge className="bg-primary text-primary-foreground gap-1"><Check className="w-3 h-3" />Selected</Badge>
                                ) : (
                                  <Button size="sm" onClick={() => pickProduct(p)} disabled={picking !== null}>
                                    {picking === p.id ? "…" : "Select"}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </Card>
                  {selectedId && top3.some((r) => r.product.id === selectedId) && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Live totals updated. Switch any time by tapping Select on another row.</p>
                  )}
                </div>
              )}

              <Input placeholder="Search options…" value={search} onChange={(e) => setSearch(e.target.value)} />

              <div className="grid gap-3">
                {filtered.map((p) => {
                  const isSelected = selectedId === p.id;
                  return (
                    <Card key={p.id} className={`p-3 flex gap-3 transition-colors cursor-pointer ${isSelected ? "border-primary bg-primary/5" : "hover:border-primary"}`} onClick={() => openDetail(p)}>
                      <CoverImage
                        category={p.category}
                        coverUrl={p.image_url}
                        vendorId={p.id}
                        alt={p.name}
                        className="w-20 h-20 rounded-md object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium leading-tight">{p.name}</h4>
                          {isSelected ? (
                            <Badge className="bg-primary text-primary-foreground text-[10px] gap-1"><Check className="w-3 h-3" />Selected</Badge>
                          ) : p.is_featured ? (
                            <Badge className="bg-gradient-gold text-primary-foreground text-[10px]">Top pick</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                        <div className="flex items-center justify-between mt-1.5 text-xs">
                          <span className="inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-primary text-primary" />{p.rating}</span>
                          <span className="font-semibold text-foreground">{fmt(p.unit_price)} <span className="text-muted-foreground font-normal">/ {p.unit_label}</span></span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {!filtered.length && <p className="text-center text-muted-foreground py-8 text-sm">No matches.</p>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!detailProduct} onOpenChange={(v) => !v && setDetailProduct(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailProduct && (() => {
            const qty = qtyForUnit(detailProduct.unit_label, guestCount);
            const sub = qty * detailProduct.unit_price;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{detailProduct.name}</DialogTitle>
                </DialogHeader>
                <CoverImage
                  category={detailProduct.category}
                  coverUrl={detailProduct.image_url}
                  vendorId={detailProduct.id}
                  alt={detailProduct.name}
                  loading="eager"
                  className="w-full h-56 object-cover rounded-md"
                />
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1"><Star className="w-4 h-4 fill-primary text-primary" />{detailProduct.rating}</span>
                    <Badge variant="outline" className="capitalize">{prettyCategory(detailProduct.category)}</Badge>
                    {detailProduct.is_featured && <Badge className="bg-gradient-gold text-primary-foreground">Top pick</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{detailProduct.description}</p>
                  {Object.keys(detailProduct.attributes ?? {}).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(detailProduct.attributes).map(([k, v]) => (
                        <Badge key={k} variant="secondary" className="text-[10px] capitalize">{k}: {String(v)}</Badge>
                      ))}
                    </div>
                  )}
                  <Card className="p-3 bg-muted/30 space-y-1">
                    <div className="flex justify-between text-sm"><span>Unit price</span><span className="font-medium">{fmt(detailProduct.unit_price)} / {detailProduct.unit_label}</span></div>
                    <div className="flex justify-between text-sm"><span>Quantity for {guestCount} guests</span><span className="font-medium">{qty}</span></div>
                    <div className="flex justify-between text-base font-semibold pt-1 border-t"><span>Subtotal</span><span className="text-primary">{fmt(sub)}</span></div>
                  </Card>
                  <Button className="w-full" onClick={() => pickProduct(detailProduct, { closeAfter: true })} disabled={picking !== null}>
                    <Check className="w-4 h-4 mr-2" />
                    {selectedId === detailProduct.id ? "Already chosen" : "Choose this"}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
