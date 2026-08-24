import { useEffect, useState } from "react";
import { coverFor, coverForAt } from "@/lib/vendor-covers";
import { cn } from "@/lib/utils";

type Props = {
  category: string;
  coverUrl?: string | null;
  vendorId: string;
  /** Grid index — use coverForAt for variety when > 0 or when listing vendors. */
  index?: number;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

/**
 * Vendor/event cover with defensive fallback.
 * Broken AI URLs, MIME mismatches, or storage timeouts fall back to bundled
 * on-category stock photos — never a blank tile.
 */
export function CoverImage({
  category,
  coverUrl,
  vendorId,
  index,
  alt,
  className,
  loading = "lazy",
}: Props) {
  const bundled =
    index != null && index >= 0
      ? coverForAt(category, null, vendorId, index)
      : coverFor(category, null, vendorId);
  const primary =
    index != null && index >= 0
      ? coverForAt(category, coverUrl, vendorId, index)
      : coverFor(category, coverUrl, vendorId);
  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(primary);
    setFailed(false);
  }, [primary]);

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={cn(className, failed && "opacity-95")}
      onError={() => {
        if (src !== bundled) {
          setSrc(bundled);
          setFailed(true);
        }
      }}
    />
  );
}

export default CoverImage;
