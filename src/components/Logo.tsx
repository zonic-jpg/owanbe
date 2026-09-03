import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import logoDancer from "@/assets/logo-mark.png";
import logoDancerDark from "@/assets/logo-mark-dark.png";
import logoDancerContrast from "@/assets/logo-mark-contrast.png";
import logoTrumpeter from "@/assets/logo-mark-trumpeter.png";
import logoTrumpeterDark from "@/assets/logo-mark-trumpeter-dark.png";
import logoTrumpeterContrast from "@/assets/logo-mark-trumpeter-contrast.png";

export type LogoVariant = "dancer" | "trumpeter";

const MARKS: Record<LogoVariant, { light: string; dark: string; contrast: string; alt: string }> = {
  dancer: {
    light: logoDancer,
    dark: logoDancerDark,
    contrast: logoDancerContrast,
    alt: "Owanbe Planner — dancing figure logo",
  },
  trumpeter: {
    light: logoTrumpeter,
    dark: logoTrumpeterDark,
    contrast: logoTrumpeterContrast,
    alt: "Owanbe Planner — trumpeter logo",
  },
};

const STORAGE_KEY = "owanbe.logoVariant";

const SIZES = {
  sm: { box: "w-9 h-9 sm:w-10 sm:h-10", img: "w-7 h-7 sm:w-8 sm:h-8", px: 40, word: "text-base sm:text-lg" },
  md: { box: "w-12 h-12", img: "w-12 h-12", px: 48, word: "text-lg" },
} as const;

export const Logo = ({
  className = "",
  variant,
  size = "md",
  showWordmark = true,
  /** The build version is a maintainer detail, so it stays out of the public chrome. */
  showVersion = false,
}: {
  className?: string;
  variant?: LogoVariant;
  size?: keyof typeof SIZES;
  showWordmark?: boolean;
  showVersion?: boolean;
}) => {
  const [active, setActive] = useState<LogoVariant>(variant ?? "dancer");

  useEffect(() => {
    if (variant) {
      setActive(variant);
      return;
    }
    const stored = (typeof window !== "undefined" &&
      (localStorage.getItem(STORAGE_KEY) as LogoVariant | null)) || null;
    if (stored && stored in MARKS) setActive(stored);

    const onChange = (e: Event) => {
      const next = (e as CustomEvent<LogoVariant>).detail;
      if (next && next in MARKS) setActive(next);
    };
    window.addEventListener("owanbe:logo-variant", onChange);
    return () => window.removeEventListener("owanbe:logo-variant", onChange);
  }, [variant]);

  const mark = MARKS[active];
  const s = SIZES[size];

  return (
    <Link to="/" className={`flex items-center gap-2.5 group min-w-0 ${className}`}>
      <div className={`${s.box} shrink-0 rounded-xl border border-border bg-background/40 flex items-center justify-center group-hover:scale-105 transition-transform`}>
        <img
          src={mark.light}
          alt={mark.alt}
          width={s.px}
          height={s.px}
          className={`${s.img} object-contain drop-shadow-md block dark:hidden contrast-more:hidden`}
        />
        <img
          src={mark.dark}
          alt=""
          aria-hidden="true"
          width={s.px}
          height={s.px}
          className={`${s.img} object-contain drop-shadow-md hidden dark:block contrast-more:dark:hidden`}
        />
        <img
          src={mark.contrast}
          alt=""
          aria-hidden="true"
          width={s.px}
          height={s.px}
          className={`${s.img} object-contain hidden contrast-more:block`}
        />
      </div>
      {showWordmark && (
        <div className="leading-none min-w-0">
          <div className={`font-display font-bold ${s.word} tracking-tight truncate`}>OwanbeX</div>
          {showVersion && (
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground -mt-0.5">v1</div>
          )}
        </div>
      )}
    </Link>
  );
};

/** Persist & broadcast a logo variant change. Call from settings UI. */
export const setLogoVariant = (v: LogoVariant) => {
  localStorage.setItem(STORAGE_KEY, v);
  window.dispatchEvent(new CustomEvent("owanbe:logo-variant", { detail: v }));
};
