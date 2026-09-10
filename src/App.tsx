import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ShortlistProvider } from "@/contexts/ShortlistContext";
import { ShortlistBar } from "@/components/ShortlistBar";
import SiteFooter from "@/components/SiteFooter";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import EventNew from "./pages/EventNew.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
import AdminGate from "./pages/AdminGate.tsx";
import EventDetail from "./pages/EventDetail.tsx";
import EventAnalytics from "./pages/EventAnalytics.tsx";
import GuestList from "./pages/GuestList.tsx";
import AsoEbi from "./pages/AsoEbi.tsx";
import Legal from "./pages/Legal.tsx";
import VendorProfile from "./pages/VendorProfile.tsx";
import Vendors from "./pages/Vendors.tsx";
import Shortlist from "./pages/Shortlist.tsx";
import BrandOnboarding from "./pages/BrandOnboarding.tsx";
import BrandDashboard from "./pages/BrandDashboard.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ErrorBoundary label="OwanbeX">
          <AuthProvider>
            <ShortlistProvider>
              {/*
                Each route gets its own boundary so a crash on one page shows
                "Something went wrong in this section" for that page only —
                ShortlistBar and SiteFooter below (part of the persistent
                shell on every page) stay mounted and usable instead of the
                whole app blanking to the single top-level fallback.
              */}
              <Routes>
                <Route path="/" element={<ErrorBoundary label="Home"><Index /></ErrorBoundary>} />
                <Route path="/auth" element={<ErrorBoundary label="Sign in"><Auth /></ErrorBoundary>} />
                <Route path="/login" element={<ErrorBoundary label="Sign in"><Auth /></ErrorBoundary>} />
                <Route path="/privacy" element={<ErrorBoundary label="Privacy"><Legal page="privacy" /></ErrorBoundary>} />
                <Route path="/terms" element={<ErrorBoundary label="Terms"><Legal page="terms" /></ErrorBoundary>} />
                <Route path="/contact" element={<ErrorBoundary label="Contact"><Legal page="contact" /></ErrorBoundary>} />
                <Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary label="Dashboard"><Dashboard /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/events/new" element={<ProtectedRoute><ErrorBoundary label="New event"><EventNew /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/events/:id" element={<ProtectedRoute><ErrorBoundary label="Event"><EventDetail /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/events/:id/analytics" element={<ProtectedRoute><ErrorBoundary label="Event analytics"><EventAnalytics /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/events/:id/guests" element={<ProtectedRoute><ErrorBoundary label="Guest list"><GuestList /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/events/:id/aso-ebi" element={<ProtectedRoute><ErrorBoundary label="Aso-ebi"><AsoEbi /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/vendors" element={<ErrorBoundary label="Vendors"><Vendors /></ErrorBoundary>} />
                <Route path="/vendors/:id" element={<ErrorBoundary label="Vendor profile"><VendorProfile /></ErrorBoundary>} />
                <Route path="/shortlist" element={<ProtectedRoute><ErrorBoundary label="Shortlist"><Shortlist /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/brand/onboarding" element={<ProtectedRoute><ErrorBoundary label="Brand onboarding"><BrandOnboarding /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/brand" element={<ProtectedRoute><ErrorBoundary label="Brand dashboard"><BrandDashboard /></ErrorBoundary></ProtectedRoute>} />
                {/* The ONLY entry point that ever accepts the shared admin
                    password — never linked from any public nav/header/footer.
                    Reachable only by navigating to /admin directly. */}
                <Route path="/admin" element={<ErrorBoundary label="Admin sign-in"><AdminGate /></ErrorBoundary>} />
                <Route path="/admin/users" element={<ProtectedRoute requireSuperAdmin><ErrorBoundary label="Admin"><Admin /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ErrorBoundary label="Profile"><Profile /></ErrorBoundary></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <ShortlistBar />
              <SiteFooter />
            </ShortlistProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
