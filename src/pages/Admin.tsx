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
import { useEffect } from "react";
import { toast } from "sonner";

export default function Admin() {
  const { isSuperAdmin, isFoundingOwner, canViewFinancials, canGrantWaivers, refreshRoles } = useAuth();
  useEffect(() => {
    document.title = "Admin panel — Owanbe Planner";
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
    m.setAttribute("content", "Manage vendors, brands, financials, waivers and roles for the Owanbe Planner marketplace.");
    if (window.location.hash === "#admintester-queue") {
      document.getElementById("admintester-queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);
  return (
    <AppShell>
      <div className="container py-6 md:py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl md:text-4xl">Admin panel</h1>
          <p className="text-muted-foreground">Approve brands, manage vendors, run financials and govern roles.</p>
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

        <Tabs defaultValue="datamode" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="datamode">Data mode</TabsTrigger>
            <TabsTrigger value="landing">Landing CMS</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="studio">Content Studio</TabsTrigger>}
            <TabsTrigger value="brands">Brand approvals</TabsTrigger>
            {canViewFinancials && <TabsTrigger value="financials">Financials</TabsTrigger>}
            {canViewFinancials && <TabsTrigger value="costs">Running costs</TabsTrigger>}
            {canGrantWaivers && <TabsTrigger value="waivers">Waivers</TabsTrigger>}
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="pricing">Pricing rules</TabsTrigger>
            <TabsTrigger value="sponsors">Sponsors</TabsTrigger>
            <TabsTrigger value="tiers">Tiers</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="gates">Payment gates</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="users">Roles</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="perms">Admin perms</TabsTrigger>}
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="covers">Cover jobs</TabsTrigger>
            <TabsTrigger value="cover-status">Cover status</TabsTrigger>
            <TabsTrigger value="cover-review">Cover review</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="404s">404s</TabsTrigger>
          </TabsList>

          <TabsContent value="datamode"><DataModeAdmin /></TabsContent>
          <TabsContent value="landing"><LandingContentAdmin /></TabsContent>
          {isSuperAdmin && <TabsContent value="studio"><ContentStudio /></TabsContent>}
          <TabsContent value="brands"><BrandApprovalsAdmin /></TabsContent>
          {canViewFinancials && <TabsContent value="financials"><FinancialsAdmin /></TabsContent>}
          {canViewFinancials && <TabsContent value="costs"><CostsAdmin /></TabsContent>}
          {canGrantWaivers && <TabsContent value="waivers"><WaiversAdmin /></TabsContent>}
          <TabsContent value="vendors"><VendorsAdmin /></TabsContent>
          <TabsContent value="catalog"><CatalogAdmin /></TabsContent>
          <TabsContent value="pricing"><PricingAdmin /></TabsContent>
          <TabsContent value="sponsors"><SponsorsAdmin /></TabsContent>
          <TabsContent value="tiers"><TiersAdmin /></TabsContent>
          {isSuperAdmin && <TabsContent value="gates"><PaymentGatesAdmin /></TabsContent>}
          {isSuperAdmin && <TabsContent value="users"><UsersAdmin /></TabsContent>}
          {isSuperAdmin && <TabsContent value="perms"><AdminPermsAdmin /></TabsContent>}
          <TabsContent value="audit"><AuditLog /></TabsContent>
          <TabsContent value="covers"><CoverJobsAdmin /></TabsContent>
          <TabsContent value="cover-status"><VendorCoverStatusAdmin /></TabsContent>
          <TabsContent value="cover-review"><CoverReviewAdmin /></TabsContent>
          <TabsContent value="cities"><CitiesAdmin /></TabsContent>
          <TabsContent value="404s"><NotFoundLogsAdmin /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
