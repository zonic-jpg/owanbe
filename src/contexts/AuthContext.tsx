import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isFoundingOwnerEmail } from "@/lib/foundingOwner";
import { ensureSessionAccess } from "@/lib/sessionAccess";
import { setDiagnosticsAudience } from "@/lib/publicMessage";

export type AppRole = "user" | "admin" | "super_admin" | "brand";
export type AdminPerm = "view_financials" | "grant_waivers";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  perms: AdminPerm[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isBrand: boolean;
  isFoundingOwner: boolean;
  canViewFinancials: boolean;
  canGrantWaivers: boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [perms, setPerms] = useState<AdminPerm[]>([]);

  const fetchRolesAndPerms = useCallback(async (uid: string) => {
    try {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("admin_permissions").select("perm").eq("user_id", uid),
      ]);
      const nextRoles = (r?.map((row) => row.role as AppRole)) ?? [];
      const nextPerms = (p?.map((row) => row.perm as AdminPerm)) ?? [];
      setRoles(nextRoles);
      setPerms(nextPerms);
    } catch (err) {
      console.warn("[auth] roles/perms unavailable (login still valid)", err);
      setRoles([]);
      setPerms([]);
    }
  }, []);

  const syncSessionAccess = useCallback(async (s: Session) => {
    try {
      const ok = await ensureSessionAccess();
      if (!ok && isFoundingOwnerEmail(s.user.email)) {
        try {
          await supabase.rpc("claim_super_admin");
        } catch (err) {
          console.warn("[auth] claim_super_admin skipped", err);
        }
      }
      await fetchRolesAndPerms(s.user.id);
    } catch (err) {
      console.warn("[auth] post-login access sync failed (session kept)", err);
    }
  }, [fetchRolesAndPerms]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => { void syncSessionAccess(s); }, 0);
      } else {
        setRoles([]);
        setPerms([]);
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) void syncSessionAccess(s);
      })
      .catch((err) => {
        console.warn("[auth] getSession failed", err);
      })
      .finally(() => {
        setLoading(false);
      });

    // Hard cap: never leave the app on a blank spinner if getSession hangs.
    const cap = window.setTimeout(() => setLoading(false), 4_000);

    return () => {
      window.clearTimeout(cap);
      subscription.unsubscribe();
    };
  }, [syncSessionAccess]);

  const refreshRoles = async () => {
    if (session) await syncSessionAccess(session);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isFoundingOwner = isFoundingOwnerEmail(user?.email);
  const isSuperAdmin = roles.includes("super_admin") || isFoundingOwner;
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isBrand = roles.includes("brand") || (user?.email ?? "").toLowerCase() === "brand@demo.local";
  const canViewFinancials = isSuperAdmin || (isAdmin && perms.includes("view_financials"));
  const canGrantWaivers = isSuperAdmin || (isAdmin && perms.includes("grant_waivers"));

  // Admins can act on infrastructure detail, so they keep the original error
  // text; everyone else only ever sees visitor-safe copy.
  useEffect(() => { setDiagnosticsAudience(isAdmin); }, [isAdmin]);

  return (
    <AuthContext.Provider value={{
      user, session, loading, roles, perms,
      isAdmin, isSuperAdmin, isBrand, isFoundingOwner, canViewFinancials, canGrantWaivers,
      refreshRoles, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
