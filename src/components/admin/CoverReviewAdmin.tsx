import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, RefreshCw, RotateCw, ImageIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const HAMMING_DUP_THRESHOLD = 8;

type Vendor = {
  id: string;
  name: string;
  category: string;
  city: string;
  cover_url: string | null;
  cover_status: string;
  cover_attempts: number;
  cover_phash: string | null;
  cover_subject_kind: string | null;
  cover_subject_gender: string | null;
  cover_style_variant: number | null;
  cover_generated_at: string | null;
};

function hammingHex(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { dist += x & 1; x >>= 1; }
  }
  return dist;
}

type CategoryStats = {
  category: string;
  total: number;
  withCover: number;
  buckets: Record<string, number>;
  bucketKeys: string[];
  duplicatePairs: number;
  avgAttempts: number;
  rerollCount: number; // covers with attempts > 1
  diversityScore: number; // 0..1, higher = more even distribution
  flagged: boolean;
};

function computeStats(vendors: Vendor[]): CategoryStats[] {
  const byCat = new Map<string, Vendor[]>();
  for (const v of vendors) {
    if (!byCat.has(v.category)) byCat.set(v.category, []);
    byCat.get(v.category)!.push(v);
  }
  const out: CategoryStats[] = [];
  for (const [category, rows] of byCat.entries()) {
    const withCover = rows.filter((r) => r.cover_url && r.cover_status === "done");
    const buckets: Record<string, number> = {};
    for (const r of withCover) {
      const k = `${r.cover_subject_kind ?? "?"}|${r.cover_subject_gender ?? "?"}`;
      buckets[k] = (buckets[k] ?? 0) + 1;
    }
    const bucketKeys = Object.keys(buckets).sort();

    // Pairwise hash comparison
    let duplicatePairs = 0;
    const hashed = withCover.filter((r) => r.cover_phash);
    for (let i = 0; i < hashed.length; i++) {
      for (let j = i + 1; j < hashed.length; j++) {
        if (hammingHex(hashed[i].cover_phash!, hashed[j].cover_phash!) <= HAMMING_DUP_THRESHOLD) {
          duplicatePairs++;
        }
      }
    }

    const attempts = withCover.map((r) => r.cover_attempts ?? 0);
    const avgAttempts = attempts.length
      ? attempts.reduce((a, b) => a + b, 0) / attempts.length
      : 0;
    const rerollCount = attempts.filter((a) => a > 1).length;

    // Shannon-style evenness across observed buckets, normalised to [0,1].
    const total = withCover.length;
    let entropy = 0;
    for (const k of bucketKeys) {
      const p = buckets[k] / total;
      if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxEntropy = bucketKeys.length > 1 ? Math.log2(bucketKeys.length) : 1;
    const diversityScore = bucketKeys.length > 1 ? entropy / maxEntropy : 0;

    out.push({
      category,
      total: rows.length,
      withCover: withCover.length,
      buckets,
      bucketKeys,
      duplicatePairs,
      avgAttempts,
      rerollCount,
      diversityScore,
      flagged: duplicatePairs > 0 || (withCover.length >= 4 && diversityScore < 0.6),
    });
  }
  return out.sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.category.localeCompare(b.category));
}

export function CoverReviewAdmin() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [rerunningIds, setRerunningIds] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendors")
      .select("id,name,category,city,cover_url,cover_status,cover_attempts,cover_phash,cover_subject_kind,cover_subject_gender,cover_style_variant,cover_generated_at")
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .limit(1000);
    if (error) toast.error(error.message);
    else setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => computeStats(vendors), [vendors]);
  const categories = useMemo(
    () => Array.from(new Set(vendors.map((v) => v.category))).sort(),
    [vendors],
  );

  // Build lookup of duplicate-pair vendor ids (per category) for highlighting.
  const dupIds = useMemo(() => {
    const set = new Set<string>();
    const byCat = new Map<string, Vendor[]>();
    for (const v of vendors) {
      if (!v.cover_phash) continue;
      if (!byCat.has(v.category)) byCat.set(v.category, []);
      byCat.get(v.category)!.push(v);
    }
    for (const rows of byCat.values()) {
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          if (hammingHex(rows[i].cover_phash!, rows[j].cover_phash!) <= HAMMING_DUP_THRESHOLD) {
            set.add(rows[i].id);
            set.add(rows[j].id);
          }
        }
      }
    }
    return set;
  }, [vendors]);

  const totals = useMemo(() => {
    const t = {
      total: vendors.length,
      withCover: 0,
      duplicatePairs: 0,
      reroll: 0,
      flaggedCategories: 0,
    };
    for (const v of vendors) if (v.cover_url && v.cover_status === "done") t.withCover++;
    for (const s of stats) {
      t.duplicatePairs += s.duplicatePairs;
      t.reroll += s.rerollCount;
      if (s.flagged) t.flaggedCategories++;
    }
    return t;
  }, [vendors, stats]);

  async function rerun(ids: string[]) {
    if (ids.length === 0) return;
    setRerunningIds((prev) => {
      const n = new Set(prev);
      ids.forEach((i) => n.add(i));
      return n;
    });
    try {
      const { error: resetErr } = await supabase
        .from("vendors")
        .update({ cover_status: "pending", cover_attempts: 0, cover_last_error: null })
        .in("id", ids);
      if (resetErr) throw resetErr;
      const { error } = await supabase.functions.invoke("generate-vendor-covers", {
        body: { batch_size: Math.min(ids.length, 50), vendor_ids: ids },
      });
      if (error) throw error;
      toast.success(`Re-running ${ids.length} cover${ids.length === 1 ? "" : "s"}`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Re-run failed: ${msg}`);
    } finally {
      setRerunningIds((prev) => {
        const n = new Set(prev);
        ids.forEach((i) => n.delete(i));
        return n;
      });
    }
  }

  const filteredStats = useMemo(() => {
    return stats.filter((s) => {
      if (onlyFlagged && !s.flagged) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      return true;
    });
  }, [stats, onlyFlagged, categoryFilter]);

  const q = search.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cover review overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Stat label="Vendors" value={totals.total} />
            <Stat label="With cover" value={totals.withCover} />
            <Stat
              label="Near-duplicate pairs"
              value={totals.duplicatePairs}
              tone={totals.duplicatePairs > 0 ? "warn" : "ok"}
            />
            <Stat label="Rerolled covers" value={totals.reroll} />
            <Stat
              label="Flagged categories"
              value={totals.flaggedCategories}
              tone={totals.flaggedCategories > 0 ? "warn" : "ok"}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            A pair is flagged as a near-duplicate when its perceptual-hash Hamming distance is ≤ {HAMMING_DUP_THRESHOLD}.
            A category is flagged when it has duplicates or fewer than 60% diversity across observed (kind, gender) buckets.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <CardTitle>Per-category breakdown</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search vendor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-[180px]"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={onlyFlagged ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyFlagged((v) => !v)}
            >
              <AlertTriangle className="mr-1 h-4 w-4" />
              {onlyFlagged ? "Showing flagged" : "Only flagged"}
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {filteredStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading…" : "No categories match these filters."}
            </p>
          ) : (
            filteredStats.map((s) => {
              const catVendors = vendors
                .filter((v) => v.category === s.category)
                .filter((v) => v.cover_url && v.cover_status === "done")
                .filter((v) => !q || v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q));
              return (
                <section key={s.category} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium capitalize">{s.category.replace(/_/g, " ")}</h3>
                      <span className="text-xs text-muted-foreground">
                        {s.withCover}/{s.total} have covers
                      </span>
                      {s.flagged && (
                        <Badge variant="destructive" className="text-[10px]">Needs review</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <Badge variant={s.duplicatePairs > 0 ? "destructive" : "outline"}>
                        Dup pairs: {s.duplicatePairs}
                      </Badge>
                      <Badge variant="outline">Rerolls: {s.rerollCount}</Badge>
                      <Badge variant="outline">Avg attempts: {s.avgAttempts.toFixed(2)}</Badge>
                      <Badge variant={s.diversityScore < 0.6 && s.withCover >= 4 ? "destructive" : "secondary"}>
                        Diversity: {Math.round(s.diversityScore * 100)}%
                      </Badge>
                    </div>
                  </div>

                  {/* Bucket bars */}
                  {s.bucketKeys.length > 0 && (
                    <div className="space-y-1">
                      {s.bucketKeys.map((k) => {
                        const count = s.buckets[k];
                        const pct = s.withCover > 0 ? (count / s.withCover) * 100 : 0;
                        return (
                          <div key={k} className="flex items-center gap-2 text-xs">
                            <span className="w-32 truncate text-muted-foreground capitalize">{k.replace("|", " · ")}</span>
                            <div className="flex-1 bg-muted rounded h-2 overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-16 text-right tabular-nums">{count} ({Math.round(pct)}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cover thumbnails */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {catVendors.map((v) => {
                      const isDup = dupIds.has(v.id);
                      const isRunning = rerunningIds.has(v.id);
                      return (
                        <div
                          key={v.id}
                          className={`group relative rounded-md border overflow-hidden ${isDup ? "border-destructive ring-1 ring-destructive/40" : ""}`}
                        >
                          <div className="aspect-square bg-muted">
                            {v.cover_url ? (
                              <img
                                src={v.cover_url}
                                alt={`${v.name} cover`}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            {isDup && (
                              <div className="absolute top-1 left-1">
                                <Badge variant="destructive" className="text-[10px]">Duplicate</Badge>
                              </div>
                            )}
                            {(v.cover_attempts ?? 0) > 1 && (
                              <div className="absolute top-1 right-1">
                                <Badge variant="secondary" className="text-[10px]">×{v.cover_attempts}</Badge>
                              </div>
                            )}
                          </div>
                          <div className="p-2 space-y-1">
                            <div className="text-xs font-medium truncate" title={v.name}>{v.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {(v.cover_subject_kind ?? "—")} · {(v.cover_subject_gender ?? "—")} · v{v.cover_style_variant ?? "—"}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-7 text-[11px]"
                              disabled={isRunning}
                              onClick={() => rerun([v.id])}
                            >
                              {isRunning ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCw className="mr-1 h-3 w-3" />
                              )}
                              Re-roll
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {s.duplicatePairs > 0 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const ids = catVendors.filter((v) => dupIds.has(v.id)).map((v) => v.id);
                          rerun(ids);
                        }}
                      >
                        Re-roll all {[...dupIds].filter((id) => catVendors.find((v) => v.id === id)).length} duplicates in this category
                      </Button>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-destructive" : ""}`}>
        {value}
      </div>
    </div>
  );
}
