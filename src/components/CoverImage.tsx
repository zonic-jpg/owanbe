import { useCallback, useEffect, useRef, useState } from "react";
import { coverFor, coverForAt } from "@/lib/vendor-covers";
import {
  looksLikeImageUrl,
  MAX_COVER_RETRIES,
  probeImageUrl,
  withRetryBust,
} from "@/lib/cover-load";
import { cn } from "@/lib/utils";

type LoadPhase = "loading" | "primary" | "retry" | "fallback" | "failed";

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
 * Broken AI URLs, MIME mismatches, or storage timeouts retry then fall back to
 * bundled on-category stock photos — never a blank tile.
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

  const remotePrimary = primary !== bundled ? primary : null;
  const [src, setSrc] = useState(primary);
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const retryCount = useRef(0);
  const mounted = useRef(true);

  const useFallback = useCallback(
    (reason: string) => {
      console.warn(`[CoverImage] ${category}/${vendorId}: ${reason} — using bundled fallback`);
      setSrc(bundled);
      setPhase("fallback");
      retryCount.current = 0;
    },
    [bundled, category, vendorId],
  );

  useEffect(() => {
    mounted.current = true;
    retryCount.current = 0;

    const boot = async () => {
      if (!remotePrimary || !looksLikeImageUrl(remotePrimary)) {
        if (remotePrimary && !looksLikeImageUrl(remotePrimary)) {
          useFallback("URL does not look like an image");
          return;
        }
        setSrc(primary);
        setPhase("primary");
        return;
      }

      setPhase("loading");
      const probe = await probeImageUrl(remotePrimary);
      if (!mounted.current) return;

      if (!probe.ok) {
        useFallback(probe.reason ?? "Image probe failed");
        return;
      }

      setSrc(withRetryBust(remotePrimary, 0));
      setPhase("primary");
    };

    void boot();
    return () => {
      mounted.current = false;
    };
  }, [primary, remotePrimary, useFallback]);

  const handleError = () => {
    if (src === bundled) {
      setPhase("failed");
      console.error(`[CoverImage] ${category}/${vendorId}: all sources failed`);
      return;
    }

    if (remotePrimary && retryCount.current < MAX_COVER_RETRIES) {
      retryCount.current += 1;
      setPhase("retry");
      setSrc(withRetryBust(remotePrimary, retryCount.current));
      return;
    }

    useFallback(`Remote cover failed after ${retryCount.current} retries`);
  };

  return (
    <img
      src={phase === "failed" ? bundled : src}
      alt={alt}
      loading={loading}
      decoding="async"
      title={phase === "fallback" ? "Showing category fallback — original cover unavailable" : undefined}
      className={cn(
        className,
        phase === "fallback" && "opacity-95",
        phase === "failed" && "opacity-80 ring-2 ring-destructive/40",
      )}
      onLoad={() => {
        if (src !== bundled && phase !== "failed") {
          setPhase(retryCount.current > 0 ? "retry" : "primary");
        }
      }}
      onError={handleError}
    />
  );
}

export default CoverImage;
