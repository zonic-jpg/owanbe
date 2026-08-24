import { ImgHTMLAttributes, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * ResponsiveImage
 * ---------------
 * A drop-in <img> wrapper that:
 *  - Enforces a per-breakpoint aspect ratio so the frame never collapses or stretches.
 *  - Picks the right `object-position` focal point per breakpoint so faces / subjects
 *    aren't cropped off on portrait phones or ultra-wide desktops.
 *  - Uses `object-cover` by default to prevent distortion (no squashed faces).
 *  - Auto-detects the rendered intrinsic ratio and falls back to `object-contain`
 *    if the container would otherwise crop more than `maxCropRatio` of the image
 *    (prevents "cut off" heads on extreme viewports).
 *  - Adds `sizes` + `loading` defaults so the browser fetches an appropriately
 *    sized asset on each screen.
 */

type Ratio = string; // e.g. "16/10", "1/1", "4/5"
type Focal =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top left"
  | "top right"
  | "bottom left"
  | "bottom right"
  | string; // any valid object-position value

export interface ResponsiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "loading"> {
  /** Aspect ratios per breakpoint. `base` is mobile-first. */
  ratio?: {
    base: Ratio;
    sm?: Ratio;
    md?: Ratio;
    lg?: Ratio;
    xl?: Ratio;
  };
  /** Focal point per breakpoint — keeps subject in frame when cropping. */
  focal?: {
    base?: Focal;
    sm?: Focal;
    md?: Focal;
    lg?: Focal;
    xl?: Focal;
  };
  /** "cover" crops to fill (default), "contain" letterboxes. */
  fit?: "cover" | "contain";
  /** Wrapper className (frame). */
  className?: string;
  /** Inner <img> className (rarely needed). */
  imgClassName?: string;
  /** Rounded corners on the frame. */
  rounded?: string;
  /** Background fill behind contained images / while loading. */
  bg?: string;
  /** Lazy by default; pass "eager" for above-the-fold hero. */
  loading?: "eager" | "lazy";
  /** Max acceptable crop ratio before auto-switching to contain. 0.45 = up to 45% cropped. */
  maxCropRatio?: number;
}

const breakpointPx = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

function buildRatioStyle(ratio: ResponsiveImageProps["ratio"]) {
  // We use CSS variables consumed by inline style to drive aspect-ratio
  // responsively without needing to dynamically generate Tailwind classes.
  if (!ratio) return undefined;
  const vars: Record<string, string> = {
    "--ar-base": ratio.base,
  };
  if (ratio.sm) vars["--ar-sm"] = ratio.sm;
  if (ratio.md) vars["--ar-md"] = ratio.md;
  if (ratio.lg) vars["--ar-lg"] = ratio.lg;
  if (ratio.xl) vars["--ar-xl"] = ratio.xl;
  return vars as React.CSSProperties;
}

function pickByWidth<T>(
  width: number,
  values: { base?: T; sm?: T; md?: T; lg?: T; xl?: T },
  fallback: T,
): T {
  if (width >= breakpointPx.xl && values.xl !== undefined) return values.xl;
  if (width >= breakpointPx.lg && values.lg !== undefined) return values.lg;
  if (width >= breakpointPx.md && values.md !== undefined) return values.md;
  if (width >= breakpointPx.sm && values.sm !== undefined) return values.sm;
  return values.base ?? fallback;
}

function parseRatio(r: Ratio): number {
  const [w, h] = r.split("/").map((n) => parseFloat(n.trim()));
  if (!w || !h) return 1;
  return w / h;
}

export function ResponsiveImage({
  ratio = { base: "4/5", md: "16/10" },
  focal = { base: "center top", md: "center" },
  fit = "cover",
  className,
  imgClassName,
  rounded = "rounded-2xl",
  bg = "bg-muted",
  loading = "lazy",
  maxCropRatio = 0.5,
  src,
  alt,
  sizes = "(min-width: 1280px) 1200px, (min-width: 1024px) 90vw, 100vw",
  onLoad,
  ...rest
}: ResponsiveImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [autoFit, setAutoFit] = useState<"cover" | "contain">(fit);
  const [focalPoint, setFocalPoint] = useState<string>(
    (focal.base as string) ?? "center",
  );

  // Recompute focal + auto-fit on resize so subjects stay in frame.
  useEffect(() => {
    const recompute = () => {
      const w = window.innerWidth;
      setFocalPoint(pickByWidth(w, focal, "center"));

      if (fit !== "cover") return; // user opted for contain — respect it
      const img = imgRef.current;
      const wrap = wrapperRef.current;
      if (!img || !wrap || !img.naturalWidth) return;

      const containerRatio = wrap.clientWidth / wrap.clientHeight;
      const imageRatio = img.naturalWidth / img.naturalHeight;
      // Fraction of the image that would be cropped when using cover.
      const cropFraction =
        containerRatio > imageRatio
          ? 1 - imageRatio / containerRatio
          : 1 - containerRatio / imageRatio;
      setAutoFit(cropFraction > maxCropRatio ? "contain" : "cover");
    };

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [focal, fit, maxCropRatio]);

  const styleVars = buildRatioStyle(ratio);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "responsive-img relative w-full overflow-hidden",
        rounded,
        bg,
        className,
      )}
      style={styleVars}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        sizes={sizes}
        loading={loading}
        decoding="async"
        onLoad={(e) => {
          // Trigger a recompute now that we know naturalWidth/Height.
          window.dispatchEvent(new Event("resize"));
          onLoad?.(e);
        }}
        className={cn(
          "absolute inset-0 h-full w-full",
          autoFit === "cover" ? "object-cover" : "object-contain",
          imgClassName,
        )}
        style={{ objectPosition: focalPoint }}
        {...rest}
      />
    </div>
  );
}

export default ResponsiveImage;
