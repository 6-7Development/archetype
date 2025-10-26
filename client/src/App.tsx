import { useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { VersionProvider } from "@/providers/version-provider";
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
import PlatformHealing from "@/pages/platform-healing";
import AgentFeatures from "@/pages/agent-features";
import NotFound from "@/pages/not-found";
import Error403 from "@/pages/error-403";
import Error500 from "@/pages/error-500";

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-destructive mb-4">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
      <Route path="/platform-healing">
        <AppLayout>
          <PlatformHealing />
        </AppLayout>
      </Route>
      <Route path="/agent-features">
        <AppLayout>
          <AgentFeatures />
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
  console.log('[APP] App component rendering...');
  
  // Initialize Google Analytics 4 on app load
  useEffect(() => {
    console.log('[APP] useEffect running - initializing GA4');
    initGA4();
    console.log('[APP] GA4 initialized');
  }, []);

  console.log('[APP] About to return JSX tree');
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark">
          <VersionProvider mobileBreakpoint={768}>
            <TooltipProvider>
              <CommandPalette />
              <Toaster />
              <Router />
            </TooltipProvider>
          </VersionProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

console.log('[APP] App module loaded successfully');

export default App;
