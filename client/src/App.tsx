import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { AppLayout } from "@/components/app-layout";
import { initGA4, trackPageView } from "@/lib/ga4";
import Landing from "@/pages/landing";
import LandingMobile from "@/pages/landing-mobile";
import Pricing from "@/pages/pricing";
import PricingSuccess from "@/pages/pricing-success";
import AuthPage from "@/pages/auth-page";
import AdminPromotePage from "@/pages/admin-promote";
import Dashboard from "@/pages/dashboard";
import Builder from "@/pages/builder";
import Workspace from "@/pages/workspace";
import Marketplace from "@/pages/marketplace";
import Analytics from "@/pages/analytics";
import Account from "@/pages/account";
import Team from "@/pages/team";
import APIKeys from "@/pages/api-keys";
import Support from "@/pages/support";
import Admin from "@/pages/admin";
import Publishing from "@/pages/publishing";
import NotFound from "@/pages/not-found";
import Error403 from "@/pages/error-403";
import Error500 from "@/pages/error-500";

function Router() {
  const [location] = useLocation();

  // Track page views on route change
  useEffect(() => {
    trackPageView(location);
  }, [location]);

  return (
    <Switch>
      {/* Public routes (no layout) */}
      <Route path="/" component={Landing} />
      <Route path="/mobile" component={LandingMobile} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/pricing/success" component={PricingSuccess} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin-promote" component={AdminPromotePage} />
      
      {/* Protected routes (with layout) */}
      <Route path="/dashboard">
        <AppLayout>
          <Dashboard />
        </AppLayout>
      </Route>
      <Route path="/builder">
        {(params) => (
          <AppLayout>
            <Builder />
          </AppLayout>
        )}
      </Route>
      <Route path="/builder/:projectId">
        {(params) => (
          <AppLayout>
            <Builder />
          </AppLayout>
        )}
      </Route>
      <Route path="/workspace" component={Workspace} />
      <Route path="/marketplace">
        <AppLayout>
          <Marketplace />
        </AppLayout>
      </Route>
      <Route path="/analytics">
        <AppLayout>
          <Analytics />
        </AppLayout>
      </Route>
      <Route path="/account">
        <AppLayout>
          <Account />
        </AppLayout>
      </Route>
      <Route path="/team">
        <AppLayout>
          <Team />
        </AppLayout>
      </Route>
      <Route path="/api-keys">
        <AppLayout>
          <APIKeys />
        </AppLayout>
      </Route>
      <Route path="/support">
        <AppLayout>
          <Support />
        </AppLayout>
      </Route>
      <Route path="/admin">
        <AppLayout>
          <Admin />
        </AppLayout>
      </Route>
      <Route path="/publishing">
        <AppLayout>
          <Publishing />
        </AppLayout>
      </Route>
      
      {/* Error pages */}
      <Route path="/error/403" component={Error403} />
      <Route path="/error/500" component={Error500} />
      
      {/* 404 - Must be last */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Initialize Google Analytics 4 on app load
  useEffect(() => {
    initGA4();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <CommandPalette />
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
