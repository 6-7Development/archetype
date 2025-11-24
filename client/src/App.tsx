import { useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/components/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { VersionProvider } from "@/providers/version-provider";
import { ConfigProvider } from "@/components/providers/ConfigProvider";
import { AppLayout } from "@/components/app-layout";
import { AdminGuard } from "@/components/admin-guard";
import { OwnerGuard } from "@/components/owner-guard";
import { initGA4, trackPageView } from "@/lib/ga4";
import { useThemeManager } from "@/hooks/useThemeManager";
import { VIBRANT_LIGHT_THEME } from "@/lib/theme/types";
import Landing from "@/pages/landing";
import Pricing from "@/pages/pricing";
import PricingSuccess from "@/pages/pricing-success";
import AuthPage from "@/pages/auth-page";
import AdminPromotePage from "@/pages/admin-promote";
import Dashboard from "@/pages/dashboard";
import Builder from "@/pages/builder";
import Workspace from "@/pages/workspace";
import DashboardWorkspace from "@/pages/dashboard-workspace";
import AdminWorkspace from "@/pages/admin-workspace";
import Marketplace from "@/pages/marketplace";
import Analytics from "@/pages/analytics";
import Account from "@/pages/account";
import Team from "@/pages/team";
import APIKeys from "@/pages/api-keys";
import Support from "@/pages/support";
import Admin from "@/pages/admin";
import Publishing from "@/pages/publishing";
import PlatformHealing from "@/pages/platform-healing";
import IncidentDashboard from "@/pages/incident-dashboard";
import WorkflowAnalytics from "@/pages/workflow-analytics";
import AgentFeatures from "@/pages/agent-features";
import Setup from "@/pages/setup";
import ArtifactDemo from "@/pages/artifact-demo";
import Deployments from "@/pages/deployments";
import DeploymentDetails from "@/pages/deployment-details";
import LomuChat from "@/pages/lomu-chat";
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
              data-testid="button-reload-page"
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
        <Builder />
      </Route>
      <Route path="/builder/:projectId">
        <Builder />
      </Route>
      <Route path="/workspace" component={Workspace} />
      <Route path="/workspace/dashboard">
        <DashboardWorkspace />
      </Route>
      <Route path="/workspace/admin">
        <AdminWorkspace />
      </Route>
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
        <OwnerGuard>
          <PlatformHealing />
        </OwnerGuard>
      </Route>
      <Route path="/incidents">
        <AppLayout>
          <OwnerGuard>
            <IncidentDashboard />
          </OwnerGuard>
        </AppLayout>
      </Route>
      <Route path="/workflow-analytics">
        <AppLayout>
          <OwnerGuard>
            <WorkflowAnalytics />
          </OwnerGuard>
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
      <Route path="/deployments">
        <AppLayout>
          <Deployments />
        </AppLayout>
      </Route>
      <Route path="/deployments/:deploymentId">
        <AppLayout>
          <DeploymentDetails />
        </AppLayout>
      </Route>
      <Route path="/artifact-demo" component={ArtifactDemo} />
      
      {/* Standalone LomuAI Chat - No project required */}
      <Route path="/lomu" component={LomuChat} />
      
      {/* Setup page - no layout needed */}
      <Route path="/setup" component={Setup} />
      
      {/* Error pages */}
      <Route path="/error/403" component={Error403} />
      <Route path="/error/500" component={Error500} />
      
      {/* 404 - Must be last */}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithTheme({ children }: { children: ReactNode }) {
  // Theme is now controlled by ThemeProvider (defaultTheme="dark")
  // No need to force VIBRANT_LIGHT_THEME - let users toggle freely
  
  return <>{children}</>;
}

function App() {
  // Initialize Google Analytics 4 on app load
  useEffect(() => {
    initGA4();
  }, []);
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <ThemeProvider defaultTheme="light">
            <AppWithTheme>
              <VersionProvider mobileBreakpoint={768}>
                <TooltipProvider>
                  <CommandPalette />
                  <Toaster />
                  <Router />
                </TooltipProvider>
              </VersionProvider>
            </AppWithTheme>
          </ThemeProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;