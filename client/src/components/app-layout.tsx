import { useState } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Terminal,
  ShoppingCart,
  User as UserIcon,
  Sparkles,
  LogIn,
  LogOut,
  Shield,
  Menu,
  X,
  Users,
  Key,
  Headphones,
  Wrench,
  ChevronDown,
  Settings as SettingsIcon,
  Zap
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { User } from "@shared/schema";
import { LogoEnhancedBadge, LomuTextLogo } from '@/components/final-logos';

interface AppLayoutProps {
  children: React.ReactNode;
}

const mainNavItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    testId: "nav-dashboard",
  },
  {
    label: "Builder",
    icon: Terminal,
    path: "/builder",
    testId: "nav-builder",
  },
  {
    label: "Marketplace",
    icon: ShoppingCart,
    path: "/marketplace",
    testId: "nav-marketplace",
  },
  {
    label: "Agent Features",
    icon: Zap,
    path: "/agent-features",
    testId: "nav-agent-features",
  },
];

const platformNavItems = [
  {
    label: "Analytics",
    icon: Sparkles,
    path: "/analytics",
    testId: "nav-analytics",
  },
  {
    label: "Team",
    icon: Users,
    path: "/team",
    testId: "nav-team",
  },
];

const settingsNavItems = [
  {
    label: "API Keys",
    icon: Key,
    path: "/api-keys",
    testId: "nav-api-keys",
  },
  {
    label: "Support",
    icon: Headphones,
    path: "/support",
    testId: "nav-support",
  },
  {
    label: "Account",
    icon: UserIcon,
    path: "/account",
    testId: "nav-account",
  },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);
  const { user, isLoading, isAuthenticated } = useAuth();

  const handleLogin = () => {
    setLocation('/auth');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Invalidate all queries to clear cached auth state
      queryClient.clear();
      setLocation('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleNavigation = (path: string) => {
    setLocation(path);
    setMobileMenuOpen(false); // Close mobile menu after navigation
  };

  const isAdmin = isAuthenticated && (user as User)?.role === 'admin';
  const isOwner = isAuthenticated && (user as User)?.isOwner;

  return (
    <div className="flex h-screen bg-background relative">
      {/* Mobile Menu Button - Only visible on mobile - PROMINENT */}
      <Button
        variant="default"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden min-h-[48px] min-w-[48px] shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        data-testid="button-mobile-menu"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </Button>

      {/* Mobile Overlay - Closes menu when clicking outside */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "w-64 border-r bg-card/30 backdrop-blur-sm flex flex-col",
        "fixed lg:relative inset-y-0 left-0 z-40",
        "transition-transform duration-300 ease-in-out lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo - PROUD & PROMINENT! */}
        <div className="h-20 border-b flex items-center px-4 gap-4">
          <LomuTextLogo size="sm" />
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Main Navigation - Always Visible */}
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || (item.path === "/builder" && location.startsWith("/builder"));
              
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 hover-elevate active-elevate-2",
                    isActive && "bg-primary/10 text-primary"
                  )}
                  onClick={() => handleNavigation(item.path)}
                  data-testid={item.testId}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Platform Section - Collapsible */}
          <Collapsible open={platformOpen} onOpenChange={setPlatformOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between hover-elevate active-elevate-2 mt-4"
                data-testid="nav-section-platform"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  platformOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {platformNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 hover-elevate active-elevate-2 pl-6",
                      isActive && "bg-primary/10 text-primary"
                    )}
                    onClick={() => handleNavigation(item.path)}
                    data-testid={item.testId}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </Button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Settings Section - Collapsible */}
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between hover-elevate active-elevate-2 mt-2"
                data-testid="nav-section-settings"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform",
                  settingsOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-1">
              {settingsNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 hover-elevate active-elevate-2 pl-6",
                      isActive && "bg-primary/10 text-primary"
                    )}
                    onClick={() => handleNavigation(item.path)}
                    data-testid={item.testId}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </Button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Admin Section - Collapsible - Only for Admins/Owners */}
          {(isAdmin || isOwner) && (
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between hover-elevate active-elevate-2 mt-2"
                  data-testid="nav-section-admin"
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    adminOpen && "rotate-180"
                  )} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {isAdmin && (
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 hover-elevate active-elevate-2 pl-6",
                      location === "/admin" && "bg-primary/10 text-primary"
                    )}
                    onClick={() => handleNavigation("/admin")}
                    data-testid="nav-admin"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="text-sm">Admin Panel</span>
                  </Button>
                )}
                {(isAdmin || isOwner) && (
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 hover-elevate active-elevate-2 pl-6",
                      location === "/platform-healing" && "bg-primary/10 text-primary"
                    )}
                    onClick={() => handleNavigation("/platform-healing")}
                    data-testid="nav-platform-healing"
                  >
                    <Wrench className="w-4 h-4" />
                    <span className="text-sm">Platform Healing</span>
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t space-y-3">
          {/* User Info / Login */}
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-32" />
              </div>
            </div>
          ) : isAuthenticated && user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={(user as User).profileImageUrl || undefined} alt={(user as User).firstName || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(user as User).firstName?.charAt(0) || (user as User).email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" data-testid="text-user-name">
                    {(user as User).firstName && (user as User).lastName 
                      ? `${(user as User).firstName} ${(user as User).lastName}`
                      : (user as User).firstName || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">
                    {(user as User).email}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full hover-elevate active-elevate-2"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              className="w-full hover-elevate active-elevate-2"
              onClick={handleLogin}
              data-testid="button-login"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )}

          {/* AI Agent Badge & Theme */}
          <div className="flex items-center justify-between pt-2">
            <Badge variant="secondary" className="font-mono text-xs">
              LomuAI
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main Content - Full width on mobile, with margin on desktop */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:w-auto">
        {children}
      </main>
    </div>
  );
}
