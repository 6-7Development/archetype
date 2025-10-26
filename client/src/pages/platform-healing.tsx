import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AdminGuard } from '@/components/admin-guard';
import { MetaSySopChat } from '@/components/meta-sysop-chat';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
  RefreshCw,
  Server,
  Cpu,
  HardDrive,
  AlertCircle,
  PlayCircle,
  XCircle,
  Pause,
  RotateCw,
  TrendingUp as TrendingUpIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
  Terminal,
  Radio,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Mock live data - replace with real WebSocket data
const useLiveMetrics = () => {
  const [metrics, setMetrics] = useState({
    overallHealth: 98,
    activeIncidents: 2,
    slaTimer: '12:45:33',
    cpuUsage: 34,
    memoryUsage: 56,
    dbConnections: 12,
    uptime: '7d 14h 23m',
    lastUpdate: new Date().toISOString(),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        cpuUsage: Math.max(0, Math.min(100, prev.cpuUsage + (Math.random() - 0.5) * 10)),
        memoryUsage: Math.max(0, Math.min(100, prev.memoryUsage + (Math.random() - 0.5) * 8)),
        dbConnections: Math.max(0, Math.min(50, prev.dbConnections + (Math.random() - 0.5) * 3)),
        lastUpdate: new Date().toISOString(),
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
};

function PlatformHealingContent() {
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const liveMetrics = useLiveMetrics();

  // Fetch platform status
  const { data: status, refetch: refetchStatus } = useQuery<any>({
    queryKey: ['/api/platform/status'],
    refetchInterval: 5000,
  });

  const { data: backupsData } = useQuery<any>({
    queryKey: ['/api/platform/backups'],
  });

  const { data: deploymentInfo } = useQuery<any>({
    queryKey: ['/api/deployment-info'],
    refetchInterval: 10000,
  });

  // Mock incident data
  const incidents = [
    {
      id: '1',
      issue: 'High memory usage detected',
      impact: 'Performance degradation',
      severity: 'warning' as const,
      owner: 'Meta-SySop',
      sla: '2h 15m',
      status: 'investigating' as const,
      progress: 45,
      details: 'Memory usage spiked to 89% on main server. Analyzing potential memory leaks in recent deployments.',
    },
    {
      id: '2',
      issue: 'Database connection pool saturation',
      impact: 'Slow query responses',
      severity: 'critical' as const,
      owner: 'Meta-SySop',
      sla: '45m',
      status: 'remediating' as const,
      progress: 75,
      details: 'Connection pool reached maximum capacity. Implementing auto-scaling strategy.',
    },
  ];

  // Mock auto-heal actions
  const autoHealActions = [
    { id: '1', action: 'Optimize database queries', status: 'running' as const, progress: 65, eta: '5m' },
    { id: '2', action: 'Clear expired sessions', status: 'completed' as const, progress: 100, eta: '0m' },
    { id: '3', action: 'Restart worker processes', status: 'pending' as const, progress: 0, eta: '10m' },
    { id: '4', action: 'Analyze error logs', status: 'running' as const, progress: 30, eta: '8m' },
  ];

  const triggerAutoHealMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/platform/auto-heal', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({ title: 'Auto-heal initiated', description: 'System diagnostics and repair started' });
      refetchStatus();
    },
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

  const getSeverityColor = (severity: 'critical' | 'warning' | 'info') => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10';
      case 'warning': return 'text-amber-500 bg-amber-500/10';
      case 'info': return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getStatusColor = (status: 'investigating' | 'remediating' | 'resolved') => {
    switch (status) {
      case 'investigating': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'remediating': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'resolved': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    }
  };

  const getActionStatusIcon = (status: 'running' | 'completed' | 'pending' | 'failed') => {
    switch (status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-muted-foreground" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* DESKTOP SIDEBAR */}
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
        {/* TOP BAR */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b">
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
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
                  <span className="truncate">Platform Diagnostics</span>
                </div>
                <div className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                  Real-time monitoring & auto-healing
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh
              </Button>
              
              <Button
                variant={chatOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setChatOpen(!chatOpen)}
                data-testid="button-toggle-chat"
              >
                <Terminal className="w-3.5 h-3.5 mr-1.5" />
                Chat
              </Button>
            </div>
          </div>

          {/* LIVE STATUS RIBBON */}
          <div className="border-t bg-card/50">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Overall Health</div>
                  <div className="text-lg font-bold flex items-center gap-1">
                    {liveMetrics.overallHealth}%
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Active Incidents</div>
                  <div className="text-lg font-bold">{liveMetrics.activeIncidents}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">SLA Timer</div>
                  <div className="text-lg font-bold font-mono">{liveMetrics.slaTimer}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                  <div className="text-lg font-bold">{liveMetrics.uptime}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN GRID AREA */}
        <div className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto p-4 space-y-6">
            {/* ACTION COMMAND STACK */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      Command Center
                    </CardTitle>
                    <CardDescription>Primary healing and diagnostic actions</CardDescription>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Radio className="w-3 h-3 animate-pulse" />
                    Live
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button
                    size="lg"
                    className="h-auto py-4 relative overflow-hidden group"
                    onClick={() => triggerAutoHealMutation.mutate()}
                    disabled={triggerAutoHealMutation.isPending}
                    data-testid="button-trigger-auto-heal"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 animate-pulse" />
                    <div className="relative flex flex-col items-center gap-2">
                      <PlayCircle className="w-6 h-6" />
                      <span className="font-semibold">Trigger Auto-Heal</span>
                      <span className="text-xs opacity-75">Full system scan & repair</span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto py-4"
                    data-testid="button-escalate"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-6 h-6 text-amber-500" />
                      <span className="font-semibold">Escalate</span>
                      <span className="text-xs opacity-75">Manual intervention</span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="h-auto py-4"
                    data-testid="button-apply-patch"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileCode className="w-6 h-6 text-blue-500" />
                      <span className="font-semibold">Apply Patch</span>
                      <span className="text-xs opacity-75">Deploy hotfix</span>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* INCIDENT RESPONSE TABLE */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Active Incidents
                  </CardTitle>
                  <CardDescription>Real-time issue tracking and remediation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {incidents.map((incident) => (
                      <Card key={incident.id} className="border-l-4" style={{ borderLeftColor: incident.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className={cn("text-xs", getSeverityColor(incident.severity))}>
                                    {incident.severity}
                                  </Badge>
                                  <Badge variant="outline" className={cn("text-xs", getStatusColor(incident.status))}>
                                    {incident.status}
                                  </Badge>
                                </div>
                                <h4 className="font-semibold text-sm">{incident.issue}</h4>
                                <p className="text-xs text-muted-foreground mt-1">{incident.impact}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedIncident(expandedIncident === incident.id ? null : incident.id)}
                                data-testid={`button-toggle-incident-${incident.id}`}
                              >
                                {expandedIncident === incident.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Owner:</span>
                                <span className="ml-2 font-medium">{incident.owner}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">SLA:</span>
                                <span className="ml-2 font-medium text-amber-500">{incident.sla}</span>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Remediation Progress</span>
                                <span className="font-semibold">{incident.progress}%</span>
                              </div>
                              <Progress value={incident.progress} className="h-2" />
                            </div>

                            {expandedIncident === incident.id && (
                              <>
                                <Separator />
                                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
                                  {incident.details}
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" className="flex-1">
                                    <RotateCw className="w-3 h-3 mr-1.5" />
                                    Re-analyze
                                  </Button>
                                  <Button size="sm" variant="outline" className="flex-1">
                                    <CheckCircle2 className="w-3 h-3 mr-1.5" />
                                    Resolve
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AUTO-HEAL ACTIONS QUEUE */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RotateCw className="w-5 h-5 text-blue-500" />
                    Auto-Heal Queue
                  </CardTitle>
                  <CardDescription>Automated remediation actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        <TableHead className="w-32">Progress</TableHead>
                        <TableHead className="w-20">ETA</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {autoHealActions.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionStatusIcon(action.status)}
                              <span className="text-sm">{action.action}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {action.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={action.progress} className="h-1.5" />
                              <span className="text-xs text-muted-foreground">{action.progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {action.eta}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* SYSTEM RESOURCES PANEL */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  System Resources
                </CardTitle>
                <CardDescription>Live performance metrics and resource utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">CPU Usage</span>
                      </div>
                      <span className="text-2xl font-bold">{Math.round(liveMetrics.cpuUsage)}%</span>
                    </div>
                    <Progress value={liveMetrics.cpuUsage} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {liveMetrics.cpuUsage > 80 ? 'High load detected' : 'Normal operation'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">Memory</span>
                      </div>
                      <span className="text-2xl font-bold">{Math.round(liveMetrics.memoryUsage)}%</span>
                    </div>
                    <Progress value={liveMetrics.memoryUsage} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {liveMetrics.memoryUsage > 80 ? 'Consider scaling' : 'Healthy levels'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-medium">DB Connections</span>
                      </div>
                      <span className="text-2xl font-bold">{Math.round(liveMetrics.dbConnections)}</span>
                    </div>
                    <Progress value={(liveMetrics.dbConnections / 50) * 100} className="h-3" />
                    <p className="text-xs text-muted-foreground">
                      {liveMetrics.dbConnections > 40 ? 'Pool near capacity' : 'Connections available'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE CHAT DRAWER */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              Meta-SySop Console
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Chat with Meta-SySop for platform diagnostics and healing
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <MetaSySopChat 
              autoCommit={false}
              autoPush={false}
            />
          </div>
        </SheetContent>
      </Sheet>
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
