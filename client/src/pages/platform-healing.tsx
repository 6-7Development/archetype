import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AdminGuard } from '@/components/admin-guard';
import { MetaSySopChat } from '@/components/meta-sysop-chat';
import { AgentProgress, ProgressStep } from '@/components/agent-progress';
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
  AlertTriangle,
  Lightbulb,
  Activity,
  FileCode,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

function PlatformHealingContent() {
  const [autoCommit, setAutoCommit] = useState(false);
  const [autoPush, setAutoPush] = useState(false);
  const { toast } = useToast();

  // Fetch platform status
  const { data: status } = useQuery<any>({
    queryKey: ['/api/platform/status'],
  });

  const { data: backupsData } = useQuery<any>({
    queryKey: ['/api/platform/backups'],
  });

  // Fetch live task progress from Meta-SySop
  const { data: tasksData } = useQuery<{ tasks: ProgressStep[] }>({
    queryKey: ['/api/platform/tasks'],
    refetchInterval: 1000, // Poll every second for real-time updates
  });

  const tasks = tasksData?.tasks || [];
  const isWorking = tasks.some(t => t.type !== 'success' && t.type !== 'error');

  // Clear tasks handler
  const handleClearTasks = async () => {
    try {
      await apiRequest('/api/platform/tasks/clear', {
        method: 'POST',
      });
      
      // Invalidate tasks query to refetch
      await queryClient.invalidateQueries({ queryKey: ['/api/platform/tasks'] });
      
      toast({
        title: 'Tasks cleared',
        description: 'All Meta-SySop tasks have been cleared',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to clear tasks',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

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
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* LEFT SIDEBAR - 220px */}
      <div className="w-[220px] flex-shrink-0 bg-slate-950/95 border-r border-slate-800/50 backdrop-blur-xl flex flex-col animate-in slide-in-from-left duration-500">
        {/* Logo */}
        <div className="p-5 border-b border-slate-800/50">
          <div className="font-bold text-sm bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">
            ARCHETYPE
          </div>
          <div className="text-[11px] text-slate-500 mt-1">AI Platform Healing</div>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 overflow-y-auto py-3">
          <div className="space-y-1 px-2">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <a className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all",
                  "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
                )} data-testid={`nav-${item.label.toLowerCase()}`}>
                  <item.icon className="w-[18px] h-[18px]" />
                  <span>{item.label}</span>
                </a>
              </Link>
            ))}
          </div>

          {/* Platform Section */}
          <div className="mt-6">
            <div className="px-4 py-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Platform
            </div>
            <div className="space-y-1 px-2">
              {platformItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <a className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all",
                    "text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
                  )} data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}>
                    <item.icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </a>
                </Link>
              ))}
            </div>
          </div>

          {/* Platform Healing - Active */}
          <div className="mt-6">
            <div className="space-y-1 px-2">
              <div className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all",
                "bg-slate-700/30 text-slate-200 border-r-2 border-slate-400"
              )} data-testid="nav-platform-healing">
                <Heart className="w-[18px] h-[18px]" />
                <span>Platform Healing</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Section - Bottom */}
        <div className="border-t border-slate-800/50 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-sm font-semibold">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-slate-200 truncate">Admin</div>
              <div className="text-[11px] text-slate-500 truncate">Platform Owner</div>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all"
            data-testid="button-sign-out"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* MAIN CONTENT - Flex 1 */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900/60">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-xl">
          <div className="flex items-center gap-4 flex-1">
            <div>
              <div className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                <Heart className="w-5 h-5 text-slate-400" />
                Meta-SySop Platform Healing
              </div>
              <div className="text-[13px] text-slate-500 mt-0.5">
                Chat with Meta-SySop to diagnose and fix platform issues
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Status Badge */}
            <div className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              status?.safety?.safe 
                ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse-glow"
                : "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
            )} data-testid="status-badge">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping-slow" />
              {status?.safety?.safe ? 'Healthy' : 'Issues'}
            </div>

            {/* Auto-commit toggle */}
            <button
              onClick={() => setAutoCommit(!autoCommit)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                autoCommit
                  ? "bg-slate-700/50 text-slate-200 border-slate-600/50"
                  : "bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/30 hover:text-slate-200"
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
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                autoPush && autoCommit
                  ? "bg-slate-700/50 text-slate-200 border-slate-600/50"
                  : "bg-slate-800/50 text-slate-400 border-slate-700/50",
                !autoCommit && "opacity-50 cursor-not-allowed",
                autoCommit && !autoPush && "hover:bg-slate-700/30 hover:text-slate-200"
              )}
              data-testid="toggle-auto-push"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-push
            </button>
          </div>
        </div>

        {/* Live Task Progress - Mobile Responsive */}
        {tasks.length > 0 && (
          <div className="border-b border-slate-800/50 p-2 sm:p-4 bg-slate-950/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-400">Task Progress</div>
              <button
                onClick={handleClearTasks}
                disabled={isWorking}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all",
                  isWorking 
                    ? "bg-slate-800/50 text-slate-600 cursor-not-allowed opacity-50"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-700/30 hover:text-slate-200"
                )}
                data-testid="button-clear-tasks"
              >
                <Trash2 className="w-3 h-3" />
                Clear Tasks
              </button>
            </div>
            <AgentProgress 
              steps={tasks}
              isWorking={isWorking}
              data-testid="meta-sysop-task-progress"
            />
          </div>
        )}

        {/* Chat Container - Mobile Safe Scrolling */}
        <div className="flex-1 min-h-0 overflow-hidden touch-none">
          <MetaSySopChat 
            autoCommit={autoCommit}
            autoPush={autoPush}
          />
        </div>
      </div>

      {/* RIGHT PANEL - 320px */}
      <div className="w-[320px] flex-shrink-0 bg-slate-950/95 border-l border-slate-800/50 backdrop-blur-xl overflow-y-auto animate-in slide-in-from-right duration-500">
        {/* Platform Status */}
        <div className="p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-300 uppercase tracking-wider mb-3.5">
            <Database className="w-4 h-4" />
            Platform Status
          </div>
          
          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-2 text-[13px] border-b border-slate-800/30">
              <span className="text-slate-500">Uncommitted Changes</span>
              <span className={cn(
                "font-semibold",
                status?.uncommittedChanges ? "text-amber-400" : "text-emerald-400"
              )}>
                {status?.uncommittedChanges ? 'Yes' : 'No'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 text-[13px] border-b border-slate-800/30">
              <span className="text-slate-500">Safety Status</span>
              <span className={cn(
                "font-semibold flex items-center gap-1.5",
                status?.safety?.safe ? "text-emerald-400" : "text-red-400"
              )}>
                {status?.safety?.safe ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Safe</>
                ) : (
                  <><AlertTriangle className="w-3.5 h-3.5" /> Issues</>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-slate-500">Backups Available</span>
              <span className="font-semibold text-slate-200">
                {backupsData?.backups?.length || 0}
              </span>
            </div>
          </div>

          {/* Safety Issues */}
          {status?.safety?.issues && status.safety.issues.length > 0 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Safety Issues:
              </div>
              <ul className="space-y-1">
                {status.safety.issues.map((issue: string, i: number) => (
                  <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                    <span className="mt-0.5">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="p-5 border-b border-slate-800/50">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-300 uppercase tracking-wider mb-3.5">
            <Activity className="w-4 h-4" />
            Recent Activity
          </div>
          
          <div className="space-y-2">
            {isWorking ? (
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 cursor-pointer hover:bg-slate-800/60 hover:border-slate-500/30 transition-all">
                <div className="text-xs font-semibold text-slate-200 mb-1.5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                  Meta-SySop is working...
                </div>
                <div className="text-[11px] text-slate-500 leading-snug">
                  {tasks.find(t => t.type !== 'success' && t.type !== 'error')?.message || 'Processing your request'}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 text-center py-4">
                All healing history is in the chat
              </div>
            )}
          </div>
        </div>

        {/* Tips Section */}
        <div className="p-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-300 uppercase tracking-wider mb-3.5">
            <Lightbulb className="w-4 h-4" />
            Pro Tips
          </div>
          
          <div className="space-y-2.5">
            <div className="bg-slate-700/20 border-l-2 border-slate-500 rounded px-3 py-2.5 text-xs text-slate-300 leading-relaxed">
              <Lightbulb className="w-3 h-3 inline mr-1.5" />
              Be specific about the issue you're experiencing
            </div>
            <div className="bg-slate-700/20 border-l-2 border-slate-500 rounded px-3 py-2.5 text-xs text-slate-300 leading-relaxed">
              <FileCode className="w-3 h-3 inline mr-1.5" />
              Meta-SySop can read and modify platform files
            </div>
            <div className="bg-slate-700/20 border-l-2 border-slate-500 rounded px-3 py-2.5 text-xs text-slate-300 leading-relaxed">
              <CheckCircle2 className="w-3 h-3 inline mr-1.5" />
              Enable auto-commit to save changes to Git
            </div>
            <div className="bg-slate-700/20 border-l-2 border-slate-500 rounded px-3 py-2.5 text-xs text-slate-300 leading-relaxed">
              <Activity className="w-3 h-3 inline mr-1.5" />
              Enable auto-push to deploy fixes immediately
            </div>
            <div className="bg-slate-700/20 border-l-2 border-slate-500 rounded px-3 py-2.5 text-xs text-slate-300 leading-relaxed">
              <Database className="w-3 h-3 inline mr-1.5" />
              All changes are backed up automatically
            </div>
          </div>
        </div>
      </div>

      {/* Add custom animations */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 currentColor;
          }
          50% {
            box-shadow: 0 0 0 8px transparent;
          }
        }
        
        @keyframes ping-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 2s infinite;
        }
        
        .animate-ping-slow {
          animation: ping-slow 1.5s infinite;
        }
      `}</style>
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
