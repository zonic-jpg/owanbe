import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Upload, Images } from "lucide-react";
import { toast } from "sonner";
import { publicError } from "@/lib/publicMessage";
import { uploadCompressedImage } from "@/lib/image-upload";
import { ImageWithFallback } from "@/components/ImageWithFallback";

type PortfolioItem = { id: string; image_url: string; caption: string | null; position: number };

/**
 * Lets a brand owner manage their vendor's public portfolio photos —
 * upload (compressed via resizeForDevices, stored in the vendor-portfolio
 * bucket) and remove. Mirrors the vendor-cover upload pipeline's shape
 * (see VendorsAdmin.tsx's onPickCoverFile).
 */
export function VendorPortfolioManager({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vendor_portfolio")
      .select("id, image_url, caption, position")
      .eq("vendor_id", vendorId)
      .order("position");
    if (error) {
      toast.error("Couldn't load your portfolio", { description: publicError(error) });
    } else {
      setItems((data ?? []) as PortfolioItem[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [vendorId]);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const path = `${vendorId}/${Date.now()}.jpg`;
      const result = await uploadCompressedImage(file, "vendor-portfolio", path, "Tablet");
      const { data, error } = await supabase
        .from("vendor_portfolio")
        .insert({ vendor_id: vendorId, image_url: result.url, position: items.length })
        .select("id, image_url, caption, position")
        .single();
      if (error) {
        toast.error("Couldn't save that photo", { description: publicError(error) });
        return;
      }
      setItems((cur) => [...cur, data as PortfolioItem]);
      toast.success("Portfolio photo added");
    } catch (err) {
      toast.error("Couldn't upload that photo", { description: publicError(err, "Please try a different image.") });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    const { error } = await supabase.from("vendor_portfolio").delete().eq("id", id);
    setRemoving(null);
    if (error) return toast.error("Couldn't remove that photo", { description: publicError(error) });
    setItems((cur) => cur.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Images className="h-4 w-4" /> Portfolio photos
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-muted/50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : "Add photo"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onPick} />
        </label>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No portfolio photos yet for {vendorName}.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {items.map((item) => (
            <div key={item.id} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
              <ImageWithFallback src={item.image_url} alt={item.caption ?? vendorName} className="h-full w-full object-cover" />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={removing === item.id}
                onClick={() => remove(item.id)}
                aria-label="Remove photo"
              >
                {removing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VendorPortfolioManager;
