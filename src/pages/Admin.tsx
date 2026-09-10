import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorsAdmin } from "@/components/admin/VendorsAdmin";
import { PricingAdmin } from "@/components/admin/PricingAdmin";
import { SponsorsAdmin } from "@/components/admin/SponsorsAdmin";
import { TiersAdmin } from "@/components/admin/TiersAdmin";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { PaymentGatesAdmin } from "@/components/admin/PaymentGatesAdmin";
import { AuditLog } from "@/components/admin/AuditLog";
import { CoverJobsAdmin } from "@/components/admin/CoverJobsAdmin";
import { VendorCoverStatusAdmin } from "@/components/admin/VendorCoverStatusAdmin";
import { CoverReviewAdmin } from "@/components/admin/CoverReviewAdmin";
import { CitiesAdmin } from "@/components/admin/CitiesAdmin";
import { NotFoundLogsAdmin } from "@/components/admin/NotFoundLogsAdmin";
import { BrandApprovalsAdmin } from "@/components/admin/BrandApprovalsAdmin";
import { WaiversAdmin } from "@/components/admin/WaiversAdmin";
import { FinancialsAdmin } from "@/components/admin/FinancialsAdmin";
import { AdminPermsAdmin } from "@/components/admin/AdminPermsAdmin";
import { CatalogAdmin } from "@/components/admin/CatalogAdmin";
import { DataModeAdmin } from "@/components/admin/DataModeAdmin";
import { CostsAdmin } from "@/components/admin/CostsAdmin";
import { ContentStudio } from "@/components/admin/ContentStudio";
import { LandingContentAdmin } from "@/components/admin/LandingContentAdmin";
import { ClaimSuperAdminCard } from "@/components/ClaimSuperAdminCard";
import { AdminTesterQueue } from "@/components/admin/AdminTesterQueue";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";

type AdminTab = {
  value: string;
  label: string;
  show: boolean;
};

export default function Admin() {
  const { isSuperAdmin, isFoundingOwner, canViewFinancials, canGrantWaivers, refreshRoles } = useAuth();
  const [tab, setTab] = useState("datamode");

  const tabs = useMemo<AdminTab[]>(
    () =>
      [
        { value: "datamode", label: "Data mode", show: true },
        { value: "landing", label: "Landing CMS", show: true },
        { value: "studio", label: "Content Studio", show: isSuperAdmin },
        { value: "brands", label: "Brand approvals", show: true },
        { value: "financials", label: "Financials", show: canViewFinancials },
        { value: "costs", label: "Running costs", show: canViewFinancials },
        { value: "waivers", label: "Waivers", show: canGrantWaivers },
        { value: "vendors", label: "Vendors", show: true },
        { value: "catalog", label: "Catalog", show: true },
        { value: "pricing", label: "Pricing rules", show: true },
        { value: "sponsors", label: "Sponsors", show: true },
        { value: "tiers", label: "Tiers", show: true },
        { value: "gates", label: "Payment gates", show: isSuperAdmin },
        { value: "users", label: "Roles", show: isSuperAdmin },
        { value: "perms", label: "Admin perms", show: isSuperAdmin },
        { value: "audit", label: "Audit log", show: true },
        { value: "covers", label: "Cover jobs", show: true },
        { value: "cover-status", label: "Cover status", show: true },
        { value: "cover-review", label: "Cover review", show: true },
        { value: "cities", label: "Cities", show: true },
        { value: "404s", label: "404s", show: true },
      ].filter((t) => t.show),
    [isSuperAdmin, canViewFinancials, canGrantWaivers],
  );

  useEffect(() => {
    document.title = "Admin panel — Owanbe Planner";
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
    m.setAttribute("content", "Manage vendors, brands, financials, waivers and roles for the Owanbe Planner marketplace.");
    if (window.location.hash === "#admintester-queue") {
      document.getElementById("admintester-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    if (!tabs.some((t) => t.value === tab)) {
      setTab(tabs[0]?.value ?? "datamode");
    }
  }, [tabs, tab]);

  return (
    <AppShell>
      <div className="container py-6 md:py-10 space-y-6 px-4 sm:px-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Admin panel</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Approve brands, manage vendors, run financials and govern roles.</p>
        </div>

        {isFoundingOwner && !isSuperAdmin && (
          <ClaimSuperAdminCard
            onClaimed={async () => {
              await refreshRoles();
              toast.success("Super admin access granted");
            }}
          />
        )}

        <AdminTesterQueue />

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          {/* Mobile: native select — avoids 20+ wrapped tab chips */}
          <label className="md:hidden block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin section</span>
            <select
              className="w-full h-12 rounded-lg border border-input bg-background px-3 text-base font-medium touch-manipulation"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
              aria-label="Admin section"
            >
              {tabs.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <TabsList className="hidden md:flex flex-wrap h-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {/* Each panel gets its own boundary — one admin tab throwing must
              not take out every other tab's Tabs/TabsList shell along with it. */}
          <TabsContent value="datamode"><ErrorBoundary label="Data mode"><DataModeAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="landing"><ErrorBoundary label="Landing content"><LandingContentAdmin /></ErrorBoundary></TabsContent>
          {isSuperAdmin && <TabsContent value="studio"><ErrorBoundary label="Content studio"><ContentStudio /></ErrorBoundary></TabsContent>}
          <TabsContent value="brands"><ErrorBoundary label="Brand approvals"><BrandApprovalsAdmin /></ErrorBoundary></TabsContent>
          {canViewFinancials && <TabsContent value="financials"><ErrorBoundary label="Financials"><FinancialsAdmin /></ErrorBoundary></TabsContent>}
          {canViewFinancials && <TabsContent value="costs"><ErrorBoundary label="Costs"><CostsAdmin /></ErrorBoundary></TabsContent>}
          {canGrantWaivers && <TabsContent value="waivers"><ErrorBoundary label="Waivers"><WaiversAdmin /></ErrorBoundary></TabsContent>}
          <TabsContent value="vendors"><ErrorBoundary label="Vendors"><VendorsAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="catalog"><ErrorBoundary label="Catalog"><CatalogAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="pricing"><ErrorBoundary label="Pricing"><PricingAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="sponsors"><ErrorBoundary label="Sponsors"><SponsorsAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="tiers"><ErrorBoundary label="Tiers"><TiersAdmin /></ErrorBoundary></TabsContent>
          {isSuperAdmin && <TabsContent value="gates"><ErrorBoundary label="Payment gates"><PaymentGatesAdmin /></ErrorBoundary></TabsContent>}
          {isSuperAdmin && <TabsContent value="users"><ErrorBoundary label="Users"><UsersAdmin /></ErrorBoundary></TabsContent>}
          {isSuperAdmin && <TabsContent value="perms"><ErrorBoundary label="Admin perms"><AdminPermsAdmin /></ErrorBoundary></TabsContent>}
          <TabsContent value="audit"><ErrorBoundary label="Audit log"><AuditLog /></ErrorBoundary></TabsContent>
          <TabsContent value="covers"><ErrorBoundary label="Cover jobs"><CoverJobsAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="cover-status"><ErrorBoundary label="Cover status"><VendorCoverStatusAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="cover-review"><ErrorBoundary label="Cover review"><CoverReviewAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="cities"><ErrorBoundary label="Cities"><CitiesAdmin /></ErrorBoundary></TabsContent>
          <TabsContent value="404s"><ErrorBoundary label="404 logs"><NotFoundLogsAdmin /></ErrorBoundary></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
