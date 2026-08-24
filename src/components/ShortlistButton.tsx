import { useShortlist } from "@/contexts/ShortlistContext";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  vendorId: string;
  vendorName?: string;
  variant?: "icon" | "full";
  className?: string;
};

export function ShortlistButton({ vendorId, vendorName, variant = "icon", className }: Props) {
  const { isShortlisted, toggle } = useShortlist();
  const active = isShortlisted(vendorId);

  if (variant === "full") {
    return (
      <Button
        variant={active ? "secondary" : "default"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(vendorId, vendorName);
        }}
        className={className}
      >
        <Heart className={cn("mr-2 h-4 w-4", active && "fill-current")} />
        {active ? "Shortlisted" : "Shortlist"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      aria-label={active ? "Remove from shortlist" : "Add to shortlist"}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(vendorId, vendorName);
      }}
      className={cn(
        "absolute top-2 right-2 z-10 h-9 w-9 rounded-full bg-background/90 backdrop-blur border shadow-sm flex items-center justify-center transition-all hover:scale-110",
        active && "bg-primary text-primary-foreground border-primary",
        className
      )}
    >
      <Heart className={cn("h-4 w-4", active && "fill-current")} />
    </button>
  );
}
