import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { flush as zonicFlush } from "@/lib/zonic-track";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Home, Calendar, Store, Shield, LogOut, User as UserIcon, Menu, Heart, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = (isAdmin: boolean, isBrand: boolean) => {
  const base = [
    { to: "/dashboard", label: "My Events", icon: Calendar },
    { to: "/vendors", label: "Vendors", icon: Store },
    { to: "/shortlist", label: "Shortlist", icon: Heart },
  ];
  if (isBrand) base.push({ to: "/brand", label: "Brand", icon: Building2 });
  if (isAdmin) base.push({ to: "/admin", label: "Admin", icon: Shield });
  return base;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isBrand, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = (user?.email ?? "U").charAt(0).toUpperCase();

  useEffect(() => { void zonicFlush(); }, []);
  const items = navItems(isAdmin, isBrand);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 font-apple pt-[env(safe-area-inset-top)]">
        <div className="container flex items-center justify-between h-14 sm:h-16 gap-2 min-w-0">
          <div className="flex items-center gap-4 sm:gap-8 min-w-0">
            <Logo size="sm" className="shrink-0" />
            <nav className="hidden md:flex items-center gap-1">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    cn(
                      "px-4 py-2 rounded-md text-sm font-semibold tracking-tight transition-colors",
                      isActive
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )
                  }
                >
                  {it.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="rounded-full p-1 h-10 w-10">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-gradient-gold text-primary-foreground font-medium">{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}>
                    <UserIcon className="w-4 h-4 mr-2" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => navigate("/auth")} className="bg-gradient-gold text-primary-foreground hover:opacity-90 h-10 px-3 sm:px-4 text-sm">
                Sign in
              </Button>
            )}

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-foreground hover:bg-muted h-10 w-10">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(18rem,88vw)]">
                <div className="mt-8 flex flex-col gap-1">
                  {user && items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 px-4 py-3.5 min-h-[48px] rounded-lg font-medium touch-manipulation",
                            isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                          )
                        }
                      >
                        <Icon className="w-5 h-5" /> {it.label}
                      </NavLink>
                    );
                  })}
                  {!user && (
                    <Link to="/auth" className="px-4 py-3.5 min-h-[48px] rounded-lg bg-gradient-gold text-primary-foreground text-center font-medium flex items-center justify-center">
                      Sign in
                    </Link>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>

      {/* Mobile bottom nav (only when signed in) */}
      {user && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border pb-[env(safe-area-inset-bottom)]">
          <div className="grid gap-1 p-1.5 max-w-md mx-auto" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
            {items.map((it) => {
              const Icon = it.icon;
              const active = location.pathname.startsWith(it.to);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[48px] rounded-lg text-[11px] font-medium touch-manipulation",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className={cn("w-5 h-5", active && "text-primary")} />
                  <span className="truncate max-w-full px-0.5">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
