import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AdminGuard } from '@/components/admin-guard';
import { MetaSySopChat } from '@/components/meta-sysop-chat';
import { 
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
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

function PlatformHealingContent() {
  const [autoCommit, setAutoCommit] = useState(false);
  const [autoPush, setAutoPush] = useState(false);

  // Fetch platform status
  const { data: status } = useQuery<any>({
    queryKey: ['/api/platform/status'],
  });

  const { data: backupsData } = useQuery<any>({
    queryKey: ['/api/platform/backups'],
  });

  // Navigation items
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Hammer, label: 'Builder', path: '/builder' },
    { icon: Store, label: 'Marketplace', path: '/templates' },
    { icon: TrendingUp, label: 'Analytics', path: '/usage' },
    { icon: Users, label: 'Team', path: '/team' },
  ];

  const platformItems = [
    { icon: Key, label: 'API Keys', path: '/api-keys' },
    { icon: MessageSquare, label: 'Support', path: '/support' },
    { icon: Settings, label: 'Account', path: '/settings' },
    { icon: Shield, label: 'Admin', path: '/admin' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* LEFT SIDEBAR */}
      <div className="w-[240px] flex-shrink-0 bg-card border-r flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="font-bold text-lg">ARCHETYPE</div>
          <div className="text-xs text-muted-foreground mt-0.5">AI Code Generation</div>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="space-y-0.5 px-2">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" data-testid={`nav-${item.label.toLowerCase()}`}>
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </a>
              </Link>
            ))}
          </div>

          {/* Platform Section */}
          <div className="mt-4">
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Platform
            </div>
            <div className="space-y-0.5 px-2">
              {platformItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <a className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </a>
                </Link>
              ))}
            </div>
          </div>

          {/* Platform Healing - Active */}
          <div className="mt-4 px-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm bg-accent text-foreground" data-testid="nav-platform-healing">
              <Heart className="w-4 h-4" />
              <span>Platform Healing</span>
            </div>
          </div>
        </div>

        {/* User Section */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Admin</div>
              <div className="text-xs text-muted-foreground truncate">Platform Owner</div>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
            data-testid="button-sign-out"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-card/50">
          <div>
            <div className="text-lg font-semibold flex items-center gap-2">
              Meta-SySop Platform Healing
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Chat with Meta-SySop to diagnose and fix platform issues
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold",
              status?.safety?.safe 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )} data-testid="status-badge">
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              {status?.safety?.safe ? 'Healthy' : 'Issues'}
            </div>

            {/* Auto-commit toggle */}
            <button
              onClick={() => setAutoCommit(!autoCommit)}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                autoCommit
                  ? "bg-accent text-foreground"
                  : "hover:bg-accent/50"
              )}
              data-testid="toggle-auto-commit"
            >
              <GitBranch className="w-3.5 h-3.5" />
              Auto-commit
            </button>

            {/* Auto-push toggle */}
            <button
              onClick={() => setAutoPush(!autoPush)}
              disabled={!autoCommit}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium border transition-colors",
                autoPush && autoCommit
                  ? "bg-accent text-foreground"
                  : "hover:bg-accent/50",
                !autoCommit && "opacity-50 cursor-not-allowed"
              )}
              data-testid="toggle-auto-push"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-push
            </button>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <MetaSySopChat 
            autoCommit={autoCommit}
            autoPush={autoPush}
          />
        </div>
      </div>

      {/* RIGHT PANEL - Simplified */}
      <div className="w-[280px] flex-shrink-0 bg-card border-l overflow-y-auto">
        {/* Platform Status */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-3">
            <Database className="w-4 h-4" />
            Platform Status
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uncommitted Changes</span>
              <span className={cn(
                "font-semibold",
                status?.uncommittedChanges ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
              )}>
                {status?.uncommittedChanges ? 'Yes' : 'No'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Safety Status</span>
              <span className={cn(
                "font-semibold flex items-center gap-1.5",
                status?.safety?.safe ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              )}>
                {status?.safety?.safe ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Safe</>
                ) : (
                  <><AlertTriangle className="w-3.5 h-3.5" /> Issues</>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Backups Available</span>
              <span className="font-semibold">
                {backupsData?.backups?.length || 0}
              </span>
            </div>
          </div>

          {/* Safety Issues */}
          {status?.safety?.issues && status.safety.issues.length > 0 && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
              <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Safety Issues:
              </div>
              <ul className="space-y-1">
                {status.safety.issues.map((issue: string, i: number) => (
                  <li key={i} className="text-xs flex items-start gap-1.5">
                    <span>•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
