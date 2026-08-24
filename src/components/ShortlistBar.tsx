import { Link, useLocation } from "react-router-dom";
import { useShortlist } from "@/contexts/ShortlistContext";
import { Button } from "@/components/ui/button";
import { Heart, GitCompare } from "lucide-react";

export function ShortlistBar() {
  const { vendorIds } = useShortlist();
  const location = useLocation();
  const count = vendorIds.size;
  if (count === 0) return null;
  if (location.pathname.startsWith("/shortlist")) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-card/95 backdrop-blur shadow-lg pl-4 pr-2 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Heart className="h-4 w-4 fill-primary text-primary" />
          <span>{count} shortlisted</span>
          {count < 3 && (
            <span className="text-muted-foreground hidden sm:inline">
              · add {3 - count} more to compare
            </span>
          )}
          {count > 5 && (
            <span className="text-amber-600 hidden sm:inline">· compare uses first 5</span>
          )}
        </div>
        <Button asChild size="sm" disabled={count < 2}>
          <Link to="/shortlist">
            <GitCompare className="mr-1.5 h-4 w-4" /> Compare
          </Link>
        </Button>
      </div>
    </div>
  );
}
