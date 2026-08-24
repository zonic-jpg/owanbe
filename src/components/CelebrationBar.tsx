import {
  Wine, Music2, Music4, Camera, Cake, Sparkles, Footprints, Utensils,
  Gem, Crown, Flower2, PartyPopper, Martini, Mic2, Gift, Shirt,
} from "lucide-react";

/**
 * Sophisticated muted-amber strip — icons only, spread across full width.
 * Two icons get a pop-out accent outline; the rest are softly muted so the
 * bar reads as texture, not chrome. No text labels.
 */
const items = [
  { Icon: Wine,         pop: true  },  // pop-out
  { Icon: Music4,       pop: false },
  { Icon: Sparkles,     pop: false },
  { Icon: Camera,       pop: false },
  { Icon: Footprints,   pop: false },
  { Icon: Martini,      pop: false },
  { Icon: Music2,       pop: false },
  { Icon: Crown,        pop: true  },  // pop-out
  { Icon: Utensils,     pop: false },
  { Icon: Cake,         pop: false },
  { Icon: Mic2,         pop: false },
  { Icon: Flower2,      pop: false },
  { Icon: Shirt,        pop: false },
  { Icon: Gift,         pop: false },
  { Icon: PartyPopper,  pop: false },
  { Icon: Gem,          pop: false },
];

export function CelebrationBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "w-full bg-gradient-to-r from-amber-800/95 via-orange-700/95 to-amber-800/95 text-amber-50/85 " +
        className
      }
    >
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between gap-3">
        {items.map(({ Icon, pop }, i) => (
          <Icon
            key={i}
            strokeWidth={1.4}
            className={
              pop
                ? "w-[22px] h-[22px] text-amber-200 drop-shadow-[0_0_6px_rgba(251,191,36,0.45)] shrink-0"
                : "w-[18px] h-[18px] opacity-45 shrink-0"
            }
          />
        ))}
      </div>
    </div>
  );
}
