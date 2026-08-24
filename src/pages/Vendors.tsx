import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Search, BadgeCheck, X, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { coverForAt } from "@/lib/vendor-covers";
import { ShortlistButton } from "@/components/ShortlistButton";
import {
  CATEGORY_GROUPS,
  ALL_CATEGORIES,
  prettyCategory,
  matchCategoryFromQuery,
  CATEGORY_ALIASES,
} from "@/lib/vendor-categories";

type Vendor = {
  id: string;
  name: string;
  category: string;
  city: string;
  price_band: string;
  rating: number;
  cover_url: string | null;
  bio: string | null;
  is_sponsored: boolean;
};

// All Nigerian state capitals + major cities and towns, alphabetised.
const CITIES = [
  "Aba", "Abakaliki", "Abeokuta", "Abuja", "Ado-Ekiti", "Afikpo", "Agbor", "Akure",
  "Asaba", "Auchi", "Awka", "Awgu", "Azare", "Bauchi", "Benin City", "Bida",
  "Birnin Kebbi", "Calabar", "Damaturu", "Dutse", "Ede", "Effurun", "Ejigbo",
  "Enugu", "Epe", "Funtua", "Gboko", "Gombe", "Gusau", "Ibadan", "Ife", "Ifo",
  "Igbo-Ora", "Ijebu-Ode", "Ikare", "Ikeja", "Ikire", "Ikirun", "Ikorodu",
  "Ikot Ekpene", "Ilawe-Ekiti", "Ila Orangun", "Ilesa", "Ilorin", "Iseyin", "Iwo",
  "Jalingo", "Jimeta", "Jos", "Kaduna", "Kafanchan", "Kano", "Katsina", "Keffi",
  "Kisi", "Kontagora", "Kumo", "Lafia", "Lagos", "Lokoja", "Maiduguri", "Makurdi",
  "Minna", "Mubi", "Nguru", "Nnewi", "Nsukka", "Offa", "Ogbomoso", "Okene",
  "Okigwe", "Okitipupa", "Ondo City", "Onitsha", "Orlu", "Oron", "Osogbo",
  "Oturkpo", "Owerri", "Owo", "Oyo", "Port Harcourt", "Potiskum", "Sagamu",
  "Sapele", "Sokoto", "Suleja", "Ughelli", "Umuahia", "Uromi", "Uyo", "Warri",
  "Wukari", "Yenagoa", "Yola", "Zaria",
];

const BANDS = ["affordable", "mid", "premium", "luxury"];

const bandLabel: Record<string, string> = {
  affordable: "₦",
  mid: "₦₦",
  premium: "₦₦₦",
  luxury: "₦₦₦₦",
};

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // All filters are multi-select.
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [cityQuery, setCityQuery] = useState("");
  const [bands, setBands] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vendors")
        .select("id,name,category,city,price_band,rating,cover_url,bio,is_sponsored")
        .eq("is_approved", true)
        .order("is_sponsored", { ascending: false })
        .order("rating", { ascending: false })
        .limit(2000);
      if (error) {
        // Previously this error was swallowed, which made a failed/blocked query
        // look identical to "no results". Surface it instead.
        console.error("Vendor load failed:", error);
        toast.error("Couldn't load vendors. Please check your connection and try again.");
      } else if (data) {
        setVendors(data as Vendor[]);
      }
      setLoading(false);
    })();
  }, []);

  // Vendor counts per category — used for chip badges and to hide empty categories.
  const countsByCategory = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of vendors) m[v.category] = (m[v.category] ?? 0) + 1;
    return m;
  }, [vendors]);

  const countsByBand = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of vendors) m[v.price_band] = (m[v.price_band] ?? 0) + 1;
    return m;
  }, [vendors]);

  // If the user types an exact category name/alias, treat it as a category filter.
  const inferredCategory = useMemo(() => matchCategoryFromQuery(q), [q]);

  // The set of categories actually in force: explicit picks win; otherwise an
  // exact-match inference from the search box.
  const activeCategories = useMemo<string[]>(
    () => (categories.length > 0 ? categories : inferredCategory ? [inferredCategory] : []),
    [categories, inferredCategory],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Skip free-text only when the query itself WAS the category signal
    // (no explicit category picked and an exact inference fired).
    const querySatisfiedByInference = categories.length === 0 && inferredCategory !== null;

    return vendors.filter((v) => {
      if (activeCategories.length > 0 && !activeCategories.includes(v.category)) return false;
      if (cities.length > 0 && !cities.includes(v.city)) return false;
      if (bands.length > 0 && !bands.includes(v.price_band)) return false;
      if (needle && !querySatisfiedByInference) {
        const aliases = CATEGORY_ALIASES[v.category] ?? [];
        const matchesText =
          v.name.toLowerCase().includes(needle) ||
          (v.bio ?? "").toLowerCase().includes(needle) ||
          v.city.toLowerCase().includes(needle) ||
          v.category.replace(/_/g, " ").includes(needle) ||
          aliases.some((a) => a.includes(needle));
        if (!matchesText) return false;
      }
      return true;
    });
  }, [vendors, q, categories, activeCategories, cities, bands, inferredCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, Vendor[]>();
    for (const v of filtered) {
      if (!map.has(v.category)) map.set(v.category, []);
      map.get(v.category)!.push(v);
    }
    return Array.from(map.entries()).sort(
      (a, b) => ALL_CATEGORIES.indexOf(a[0]) - ALL_CATEGORIES.indexOf(b[0]),
    );
  }, [filtered]);

  const hasActiveFilters =
    categories.length > 0 || cities.length > 0 || bands.length > 0 || q.trim().length > 0;

  const resetFilters = () => {
    setQ("");
    setCategories([]);
    setCities([]);
    setBands([]);
  };

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, val: string) =>
    setter((prev) => (prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]));

  const filteredCityOptions = useMemo(() => {
    const n = cityQuery.trim().toLowerCase();
    return n ? CITIES.filter((c) => c.toLowerCase().includes(n)) : CITIES;
  }, [cityQuery]);

  const categoryTriggerLabel =
    categories.length === 0
      ? "All categories"
      : categories.length === 1
        ? prettyCategory(categories[0])
        : `${categories.length} categories`;

  const bandTriggerLabel =
    bands.length === 0
      ? "Any price"
      : bands.length === 1
        ? `${bandLabel[bands[0]]} ${bands[0]}`
        : `${bands.length} price bands`;

  const showFlatGrid = activeCategories.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="font-apple-tight text-3xl md:text-4xl text-foreground">
            Vendor directory
          </h1>
          <p className="text-muted-foreground mt-2">
            {vendors.length}+ vetted Nigerian suppliers across {ALL_CATEGORIES.length} categories.
          </p>
        </header>

        {/* Filter bar — solid (no backdrop-blur) to avoid scroll jitter under the sticky header */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 sticky top-16 z-10 bg-background border rounded-xl p-3 shadow-soft">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, keyword or category (e.g. 'small chops')…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {inferredCategory && categories.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1 pl-1">
                Showing{" "}
                <span className="font-medium text-foreground">
                  {prettyCategory(inferredCategory)}
                </span>{" "}
                matches
              </p>
            )}
          </div>

          {/* Category — multi-select */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal h-10 px-3 text-sm gap-2">
                <span className="flex-1 truncate text-left">{categoryTriggerLabel}</span>
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search categories…"
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-1">
                {CATEGORY_GROUPS.map((group) => {
                  const n = categoryQuery.trim().toLowerCase();
                  const visible = group.categories.filter((c) =>
                    n ? prettyCategory(c).toLowerCase().includes(n) : true,
                  );
                  if (visible.length === 0) return null;
                  return (
                    <div key={group.label} className="mb-1">
                      <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </p>
                      {visible.map((c) => (
                        <label
                          key={c}
                          className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-muted cursor-pointer text-sm leading-none"
                        >
                          <Checkbox
                            checked={categories.includes(c)}
                            onCheckedChange={() => toggleIn(setCategories, c)}
                            className="shrink-0"
                          />
                          <span className="flex-1 truncate text-left">{prettyCategory(c)}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {countsByCategory[c] ?? 0}
                          </span>
                        </label>
                      ))}
                    </div>
                  );
                })}
              </div>
              {categories.length > 0 && (
                <div className="p-2 border-t flex justify-between items-center">
                  <Button variant="ghost" size="sm" onClick={() => setCategories([])}>Clear</Button>
                  <span className="text-xs text-muted-foreground pr-1">{categories.length} selected</span>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <div className="grid grid-cols-2 gap-3">
            {/* City — multi-select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal h-10 px-3 text-sm gap-2">
                  <span className="flex-1 truncate text-left">
                    {cities.length === 0
                      ? "All cities"
                      : cities.length === 1
                        ? cities[0]
                        : `${cities.length} cities`}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <div className="p-2 border-b">
                  <Input
                    placeholder="Search cities…"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {filteredCityOptions.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-muted cursor-pointer text-sm leading-none"
                    >
                      <Checkbox
                        checked={cities.includes(c)}
                        onCheckedChange={() => toggleIn(setCities, c)}
                        className="shrink-0"
                      />
                      <span className="flex-1 truncate text-left">{c}</span>
                    </label>
                  ))}
                  {filteredCityOptions.length === 0 && (
                    <p className="px-2.5 py-3 text-sm text-muted-foreground">No matches</p>
                  )}
                </div>
                {cities.length > 0 && (
                  <div className="p-2 border-t flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => setCities([])}>Clear</Button>
                    <span className="text-xs text-muted-foreground pr-1">{cities.length} selected</span>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Price — multi-select */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal h-10 px-3 text-sm gap-2">
                  <span className="flex-1 truncate text-left">{bandTriggerLabel}</span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="start">
                {BANDS.map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-muted cursor-pointer text-sm leading-none capitalize"
                  >
                    <Checkbox
                      checked={bands.includes(b)}
                      onCheckedChange={() => toggleIn(setBands, b)}
                      className="shrink-0"
                    />
                    <span className="flex-1 text-left">
                      <span className="text-primary mr-1">{bandLabel[b]}</span>
                      {b}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {countsByBand[b] ?? 0}
                    </span>
                  </label>
                ))}
                {bands.length > 0 && (
                  <div className="mt-1 border-t flex justify-between items-center pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setBands([])}>Clear</Button>
                    <span className="text-xs text-muted-foreground pr-1">{bands.length} selected</span>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {categories.map((c) => (
              <FilterChip key={c} label={prettyCategory(c)} onClear={() => toggleIn(setCategories, c)} />
            ))}
            {cities.map((c) => (
              <FilterChip key={c} label={c} onClear={() => toggleIn(setCities, c)} />
            ))}
            {bands.map((b) => (
              <FilterChip key={b} label={`${bandLabel[b]} ${b}`} onClear={() => toggleIn(setBands, b)} />
            ))}
            {q && <FilterChip label={`"${q}"`} onClear={() => setQ("")} />}
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs">
              Clear all
            </Button>
          </div>
        )}

        {/* Category quick-pick — light Apple-style card (replaces the old dark "noir" panel) */}
        {categories.length === 0 && !inferredCategory && (
          <div className="mb-10 rounded-2xl border bg-card px-6 py-7 md:px-8 md:py-9 shadow-soft">
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">
                  Browse the directory
                </p>
                <h2 className="mt-1 font-apple-tight text-2xl md:text-3xl text-foreground">
                  Pick your categories
                </h2>
              </div>
              <span className="hidden md:inline text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {ALL_CATEGORIES.length} categories · {vendors.length} vendors
              </span>
            </div>

            <div className="space-y-5">
              {CATEGORY_GROUPS.map((group) => {
                const visible = group.categories.filter((c) => (countsByCategory[c] ?? 0) > 0);
                if (visible.length === 0) return null;
                return (
                  <div key={group.label}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {visible.map((c) => (
                        <button
                          key={c}
                          onClick={() => toggleIn(setCategories, c)}
                          className="group inline-flex w-full items-center justify-between gap-2.5 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground transition-all hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-soft"
                        >
                          <span className="font-medium truncate">{prettyCategory(c)}</span>
                          <span className="text-muted-foreground tabular-nums">{countsByCategory[c]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              No vendors match those filters. Try widening your search.
            </p>
            <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
              Reset filters
            </Button>
          </div>
        ) : showFlatGrid ? (
          <VendorGrid vendors={filtered} />
        ) : (
          <div className="space-y-12">
            {grouped.map(([cat, list]) => (
              <section key={cat}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="font-apple text-xl text-foreground">{prettyCategory(cat)}</h2>
                  <span className="text-sm text-muted-foreground">{list.length} vendors</span>
                </div>
                <VendorGrid vendors={list.slice(0, 8)} />
                {list.length > 8 && (
                  <button
                    onClick={() => setCategories([cat])}
                    className="mt-4 text-sm font-medium text-primary hover:underline"
                  >
                    See all {list.length} {prettyCategory(cat)} →
                  </button>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
      <span className="text-xs">{label}</span>
      <button
        onClick={onClear}
        aria-label={`Remove ${label} filter`}
        className="rounded-full hover:bg-background/50 p-0.5"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function VendorGrid({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {vendors.map((v, i) => {
        return (
          <div key={v.id} className="relative group">
            <ShortlistButton vendorId={v.id} vendorName={v.name} />
            <Link to={`/vendors/${v.id}`} className="block">
              <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow border-border/60">
                <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                  <img
                    src={coverForAt(v.category, v.cover_url, v.id, i)}
                    alt={`${prettyCategory(v.category)} — ${v.name}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Neutral gradient only for badge legibility — no colour/hue shift on the photo itself */}
                  <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 pointer-events-none bg-gradient-to-t from-black/35 to-transparent" />
                  {v.is_sponsored && (
                    <Badge className="absolute top-2 left-2 gap-1 z-10">
                      <BadgeCheck className="h-3 w-3" /> Featured
                    </Badge>
                  )}
                  <Badge variant="secondary" className="absolute bottom-2 right-2 z-10">
                    {bandLabel[v.price_band] ?? v.price_band}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold leading-tight line-clamp-1">{v.name}</h3>
                    <div className="flex items-center gap-1 text-sm shrink-0">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {Number(v.rating).toFixed(1)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 capitalize flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {v.city} · {prettyCategory(v.category)}
                  </p>
                  {v.bio && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{v.bio}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
