import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AdminGuard } from '@/components/admin-guard';
import { MetaSySopChat } from '@/components/meta-sysop-chat';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Menu,
  LayoutDashboard, 
  Hammer, 
  Store, 
  TrendingUp, 
  Users, 
  Key, 
  MessageSquare, 
  Settings, 
  Shield, 
  Heart, 
  LogOut,
  Database,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Activity,
  FileCode,
  Clock,
  Zap,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

function PlatformHealingContent() {
  const [autoCommit, setAutoCommit] = useState(false);
  const [autoPush, setAutoPush] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Fetch platform status
  const { data: status, refetch: refetchStatus } = useQuery<any>({
    queryKey: ['/api/platform/status'],
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  const { data: backupsData } = useQuery<any>({
    queryKey: ['/api/platform/backups'],
  });

  const { data: deploymentInfo } = useQuery<any>({
    queryKey: ['/api/deployment-info'],
    refetchInterval: 10000,
  });

  // Navigation items
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Hammer, label: 'Builder', path: '/builder' },
    { icon: Store, label: 'Marketplace', path: '/marketplace' },
    { icon: TrendingUp, label: 'Analytics', path: '/analytics' },
    { icon: Users, label: 'Team', path: '/team' },
    { icon: Key, label: 'API Keys', path: '/api-keys' },
    { icon: MessageSquare, label: 'Support', path: '/support' },
    { icon: Settings, label: 'Account', path: '/account' },
    { icon: Shield, label: 'Admin', path: '/admin' },
  ];

  const NavigationMenu = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="space-y-1">
      {navItems.map((item) => (
        <Link key={item.path} href={item.path}>
          <a 
            onClick={onItemClick}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover-elevate transition-colors" 
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span>{item.label}</span>
          </a>
        </Link>
      ))}
      <div className="pt-2 border-t">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-primary/10 text-primary font-medium" data-testid="nav-platform-healing">
          <Heart className="w-4 h-4 flex-shrink-0" />
          <span>Platform Healing</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* DESKTOP SIDEBAR - Hidden on mobile */}
      <div className="hidden lg:flex w-64 flex-shrink-0 bg-card border-r flex-col">
        <div className="p-4 border-b">
          <Link href="/">
            <a className="block">
              <div className="font-bold text-lg">ARCHETYPE</div>
              <div className="text-xs text-muted-foreground mt-0.5">AI Platform Healing</div>
            </a>
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          <NavigationMenu />
        </div>

        <div className="border-t p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-semibold">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Admin</div>
              <div className="text-xs text-muted-foreground truncate">Platform Owner</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            data-testid="button-sign-out"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* MOBILE/DESKTOP TOP BAR */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile Menu Button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b">
                      <div className="font-bold text-lg">ARCHETYPE</div>
                      <div className="text-xs text-muted-foreground mt-0.5">AI Platform</div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      <NavigationMenu onItemClick={() => setMobileMenuOpen(false)} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <div className="text-base lg:text-lg font-semibold flex items-center gap-2 truncate">
                  <Heart className="w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0 text-primary" />
                  <span className="truncate">Meta-SySop Healing</span>
                </div>
                <div className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                  Diagnose and fix platform issues
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge 
                variant={status?.safety?.safe ? "default" : "destructive"}
                className="hidden sm:flex items-center gap-1.5"
                data-testid="status-badge"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {status?.safety?.safe ? 'Healthy' : 'Issues'}
              </Badge>

              <Button
                variant={autoCommit ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoCommit(!autoCommit)}
                className="hidden md:flex"
                data-testid="toggle-auto-commit"
              >
                <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                Auto-commit
              </Button>
            </div>
          </div>
        </div>

        {/* CONTENT AREA - Responsive Layout */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full lg:grid lg:grid-cols-[1fr,320px] xl:grid-cols-[1fr,380px]">
            {/* CHAT PANEL */}
            <div className="h-full overflow-hidden">
              <MetaSySopChat 
                autoCommit={autoCommit}
                autoPush={autoPush}
              />
            </div>

            {/* RIGHT PANEL - Desktop only, mobile shows in tabs */}
            <div className="hidden lg:block h-full overflow-y-auto bg-card border-l">
              <StatusPanel 
                status={status} 
                backupsData={backupsData}
                deploymentInfo={deploymentInfo}
                onRefresh={refetchStatus}
              />
            </div>
          </div>
        </div>

        {/* MOBILE BOTTOM TABS */}
        <div className="lg:hidden border-t bg-card">
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="w-full grid grid-cols-3 rounded-none h-12">
              <TabsTrigger value="chat" className="gap-1.5" data-testid="tab-chat">
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="status" className="gap-1.5" data-testid="tab-status">
                <Activity className="w-4 h-4" />
                <span className="text-xs">Status</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5" data-testid="tab-settings">
                <Settings className="w-4 h-4" />
                <span className="text-xs">Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="mt-0 max-h-[50vh] overflow-y-auto p-4">
              <StatusPanel 
                status={status} 
                backupsData={backupsData}
                deploymentInfo={deploymentInfo}
                onRefresh={refetchStatus}
              />
            </TabsContent>

            <TabsContent value="settings" className="mt-0 max-h-[50vh] overflow-y-auto p-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Automation Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant={autoCommit ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAutoCommit(!autoCommit)}
                    className="w-full justify-start"
                    data-testid="toggle-auto-commit-mobile"
                  >
                    <GitBranch className="w-4 h-4 mr-2" />
                    {autoCommit ? 'Auto-commit ON' : 'Auto-commit OFF'}
                  </Button>
                  <Button
                    variant={autoPush ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAutoPush(!autoPush)}
                    disabled={!autoCommit}
                    className="w-full justify-start"
                    data-testid="toggle-auto-push-mobile"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {autoPush ? 'Auto-push ON' : 'Auto-push OFF'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function StatusPanel({ status, backupsData, deploymentInfo, onRefresh }: any) {
  return (
    <div className="space-y-4 p-4">
      {/* Platform Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="w-4 h-4" />
              Platform Status
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={onRefresh}
              data-testid="button-refresh-status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Changes</span>
            <Badge variant={status?.uncommittedChanges ? "destructive" : "secondary"} className="text-xs">
              {status?.uncommittedChanges ? 'Uncommitted' : 'Clean'}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Safety</span>
            <Badge variant={status?.safety?.safe ? "default" : "destructive"} className="text-xs gap-1">
              {status?.safety?.safe ? (
                <><CheckCircle2 className="w-3 h-3" /> Safe</>
              ) : (
                <><AlertTriangle className="w-3 h-3" /> Issues</>
              )}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Backups</span>
            <span className="font-semibold text-xs">{backupsData?.backups?.length || 0}</span>
          </div>

          {deploymentInfo?.environment && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Environment</span>
              <Badge variant="outline" className="text-xs">
                {deploymentInfo.environment}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Safety Issues */}
      {status?.safety?.issues && status.safety.issues.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Active Issues ({status.safety.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {status.safety.issues.map((issue: string, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2 p-2 rounded-md bg-destructive/5">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0 text-destructive" />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity - Collapsible */}
      <Accordion type="single" collapsible defaultValue="activity">
        <AccordionItem value="activity" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="w-4 h-4" />
              Recent Activity
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <div className="space-y-2">
              <ActivityItem 
                icon={FileCode}
                title="Files analyzed"
                time="2 min ago"
                status="success"
              />
              <ActivityItem 
                icon={GitBranch}
                title="Git status checked"
                time="5 min ago"
                status="success"
              />
              <ActivityItem 
                icon={Zap}
                title="Dependencies scanned"
                time="10 min ago"
                status="success"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Deployment Info */}
      {deploymentInfo && (
        <Accordion type="single" collapsible>
          <AccordionItem value="deployment" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <GitBranch className="w-4 h-4" />
                Deployment Info
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Branch</span>
                <span className="font-mono">{deploymentInfo.branch || 'main'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Commit</span>
                <span className="font-mono">{deploymentInfo.commit?.substring(0, 7) || 'N/A'}</span>
              </div>
              {deploymentInfo.lastDeploy && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last Deploy</span>
                  <span>{new Date(deploymentInfo.lastDeploy).toLocaleString()}</span>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

function ActivityItem({ icon: Icon, title, time, status }: any) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-md hover-elevate">
      <div className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
        status === 'success' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        status === 'warning' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        status === 'error' && "bg-red-500/10 text-red-600 dark:text-red-400"
      )}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{title}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" />
          {time}
        </div>
      </div>
    </div>
  );
}

export default function PlatformHealing() {
  return (
    <AdminGuard>
      <PlatformHealingContent />
    </AdminGuard>
  );
}
