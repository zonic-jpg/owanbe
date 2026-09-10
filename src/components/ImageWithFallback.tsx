import { useCallback, useEffect, useRef, useState } from "react";
import {
  looksLikeImageUrl,
  MAX_COVER_RETRIES,
  probeImageUrl,
  withRetryBust,
} from "@/lib/cover-load";
import { cn } from "@/lib/utils";

type LoadPhase = "loading" | "primary" | "retry" | "fallback" | "failed";

type Props = {
  src: string | null | undefined;
  /** Shown once the primary image is confirmed broken. Defaults to the app's generic placeholder. */
  fallbackSrc?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

/**
 * Lighter sibling of CoverImage for images that don't have a category/vendor
 * cover pool to fall back into (vendor portfolio photos, catalog swatches,
 * etc.) — same defensive shape: HEAD-probe before load, retry with
 * cache-busting, then a plain fallback image instead of a broken tile.
 */
export function ImageWithFallback({
  src,
  fallbackSrc = "/placeholder.svg",
  alt,
  className,
  loading = "lazy",
}: Props) {
  const hasSrc = !!(src && src.trim().length > 0);
  const [current, setCurrent] = useState(hasSrc ? (src as string) : fallbackSrc);
  const [phase, setPhase] = useState<LoadPhase>(hasSrc ? "loading" : "fallback");
  const retryCount = useRef(0);
  const mounted = useRef(true);

  const useFallback = useCallback(
    (reason: string) => {
      console.warn(`[ImageWithFallback] ${alt}: ${reason} — using fallback`);
      setCurrent(fallbackSrc);
      setPhase("fallback");
      retryCount.current = 0;
    },
    [alt, fallbackSrc],
  );

  useEffect(() => {
    mounted.current = true;
    retryCount.current = 0;

    if (!hasSrc) {
      setCurrent(fallbackSrc);
      setPhase("fallback");
      return () => {
        mounted.current = false;
      };
    }

    const boot = async () => {
      const url = src as string;
      if (!looksLikeImageUrl(url)) {
        useFallback("URL does not look like an image");
        return;
      }
      setPhase("loading");
      const probe = await probeImageUrl(url);
      if (!mounted.current) return;
      if (!probe.ok) {
        useFallback(probe.reason ?? "Image probe failed");
        return;
      }
      setCurrent(withRetryBust(url, 0));
      setPhase("primary");
    };

    void boot();
    return () => {
      mounted.current = false;
    };
  }, [src, hasSrc, fallbackSrc, useFallback]);

  const handleError = () => {
    if (current === fallbackSrc) {
      setPhase("failed");
      console.error(`[ImageWithFallback] ${alt}: fallback also failed to load`);
      return;
    }
    if (hasSrc && retryCount.current < MAX_COVER_RETRIES) {
      retryCount.current += 1;
      setPhase("retry");
      setCurrent(withRetryBust(src as string, retryCount.current));
      return;
    }
    useFallback(`failed after ${retryCount.current} retries`);
  };

  return (
    <img
      src={current}
      alt={alt}
      loading={loading}
      decoding="async"
      title={phase === "fallback" ? "Showing placeholder — original image unavailable" : undefined}
      className={cn(className, phase === "fallback" && "opacity-95", phase === "failed" && "opacity-80")}
      onLoad={() => {
        if (current !== fallbackSrc && phase !== "failed") {
          setPhase(retryCount.current > 0 ? "retry" : "primary");
        }
      }}
      onError={handleError}
    />
  );
}

export default ImageWithFallback;
