/**
 * RBAC-Aware IDE Tabs Panel
 * ==========================
 * Renders all IDE tabs based on user permissions from ide-tabs.config.ts
 * Automatically shows/hides tabs based on RBAC
 */

import { useState, useMemo, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, type Role } from "@shared/rbac";
import { cn } from "@/lib/utils";
import {
  IDE_TABS,
  getAccessibleTabs,
  getDefaultTab,
  type TabId,
  type IDETabConfig,
} from "@/config/ide-tabs.config";

import { Terminal } from "@/components/terminal";
import { LivePreview } from "@/components/live-preview";
import { FileBrowser } from "@/components/file-browser";
import { DatabaseViewer } from "@/components/database-viewer";
import { GitPanel } from "@/components/git-panel";
import { EnvBrowser } from "@/components/env-browser";
import { LogsViewer } from "@/components/logs-viewer";
import { PackageManager } from "@/components/package-manager";
import { SearchPanel } from "@/components/search-panel";
import { ProblemsPanel } from "@/components/problems-panel";
import { TestingPanel } from "@/components/testing-panel";
import type { User } from "@shared/schema";

interface IDETabsPanelProps {
  projectId?: string | null;
  activeContext: 'platform' | 'project' | 'architect';
  onTabChange?: (tabId: TabId) => void;
  className?: string;
  chatContent?: React.ReactNode;
}

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="space-y-4 w-full max-w-md">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

export function IDETabsPanel({
  projectId,
  activeContext,
  onTabChange,
  className,
  chatContent,
}: IDETabsPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const userRole = ((user as User)?.role as Role) || 'user';
  const isOwner = (user as User)?.isOwner || false;
  
  const effectiveRole: Role = isOwner ? 'owner' : userRole;

  const accessibleTabs = useMemo(() => {
    return getAccessibleTabs(effectiveRole, hasPermission);
  }, [effectiveRole]);

  const defaultTab = useMemo(() => getDefaultTab(accessibleTabs), [accessibleTabs]);
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const handleTabChange = (value: string) => {
    const tabId = value as TabId;
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const renderTabContent = (tab: IDETabConfig) => {
    switch (tab.id) {
      case 'chat':
        return chatContent || (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Chat content passed via props
          </div>
        );
      
      case 'preview':
        return <LivePreview url={projectId ? `/api/preview/${projectId}` : undefined} />;
      
      case 'terminal':
        return <Terminal projectId={projectId || undefined} />;
      
      case 'files':
        return <FileBrowser projectId={projectId || undefined} onFileSelect={() => {}} />;
      
      case 'database':
        return <DatabaseViewer />;
      
      case 'git':
        return <GitPanel />;
      
      case 'env':
        return (
          <div className="h-full p-4">
            <EnvBrowser isOpen={true} onClose={() => {}} />
          </div>
        );
      
      case 'logs':
        return <LogsViewer />;
      
      case 'tests':
        return <TestingPanel session={null} />;
      
      case 'packages':
        return <PackageManager />;
      
      case 'search':
        return <SearchPanel />;
      
      case 'problems':
        return <ProblemsPanel />;
      
      case 'deployments':
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">Deployments</h3>
            <p className="text-muted-foreground">Deployment management coming soon</p>
          </div>
        );
      
      case 'swarm':
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">SWARM Mode</h3>
            <Badge variant="secondary">Admin Feature</Badge>
            <p className="text-muted-foreground mt-2">Parallel multi-agent execution dashboard</p>
          </div>
        );
      
      case 'monitoring':
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">System Monitoring</h3>
            <Badge variant="secondary">Admin Feature</Badge>
            <p className="text-muted-foreground mt-2">Real-time system health metrics</p>
          </div>
        );
      
      case 'analytics':
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">Analytics</h3>
            <Badge variant="secondary">Admin Feature</Badge>
            <p className="text-muted-foreground mt-2">Usage and performance analytics</p>
          </div>
        );
      
      case 'healing':
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">Platform Healing</h3>
            <Badge variant="destructive">Owner Only</Badge>
            <p className="text-muted-foreground mt-2">
              Self-healing controls for platform source code
            </p>
          </div>
        );
      
      case 'incidents':
        return (
          <div className="p-4">
            <h3 className="text-lg font-medium mb-4">Incidents</h3>
            <Badge variant="destructive">Owner Only</Badge>
            <p className="text-muted-foreground mt-2">View and manage platform incidents</p>
          </div>
        );
      
      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Tab content for {tab.label}
          </div>
        );
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Please log in to access the IDE
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className={cn("flex flex-col h-full", className)}
    >
      <ScrollArea className="w-full border-b">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-none bg-muted/50 p-1 gap-1">
          {accessibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isAdminTab = tab.category === 'admin' || tab.category === 'operations';
            
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "gap-1.5 text-xs whitespace-nowrap px-3",
                  isAdminTab && "text-amber-600 dark:text-amber-400"
                )}
                data-testid={tab.testId}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.shortLabel || tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div className="flex-1 overflow-hidden">
        {accessibleTabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="h-full m-0 data-[state=inactive]:hidden"
            data-testid={`content-${tab.id}`}
          >
            <Suspense fallback={<TabLoadingFallback />}>
              {renderTabContent(tab)}
            </Suspense>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

export function useAccessibleTabs() {
  const { user } = useAuth();
  const userRole = ((user as User)?.role as Role) || 'user';
  const isOwner = (user as User)?.isOwner || false;
  const effectiveRole: Role = isOwner ? 'owner' : userRole;
  
  return useMemo(() => {
    return getAccessibleTabs(effectiveRole, hasPermission);
  }, [effectiveRole]);
}
