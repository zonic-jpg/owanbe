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
import ComingSoon from "./pages/ComingSoon.tsx";
import EventNew from "./pages/EventNew.tsx";
import Profile from "./pages/Profile.tsx";
import Admin from "./pages/Admin.tsx";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <ShortlistProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacy" element={<Legal page="privacy" />} />
              <Route path="/terms" element={<Legal page="terms" />} />
              <Route path="/contact" element={<Legal page="contact" />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/events/new" element={<ProtectedRoute><EventNew /></ProtectedRoute>} />
              <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
              <Route path="/events/:id/analytics" element={<ProtectedRoute><EventAnalytics /></ProtectedRoute>} />
              <Route path="/events/:id/guests" element={<ProtectedRoute><GuestList /></ProtectedRoute>} />
              <Route path="/events/:id/aso-ebi" element={<ProtectedRoute><AsoEbi /></ProtectedRoute>} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/vendors/:id" element={<VendorProfile />} />
              <Route path="/shortlist" element={<ProtectedRoute><Shortlist /></ProtectedRoute>} />
              <Route path="/brand/onboarding" element={<ProtectedRoute><BrandOnboarding /></ProtectedRoute>} />
              <Route path="/brand" element={<ProtectedRoute><BrandDashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requireSuperAdmin><Admin /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <ShortlistBar />
            <SiteFooter />
          </ShortlistProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
