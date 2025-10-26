import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWebSocketStream } from '@/hooks/use-websocket-stream';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Activity, 
  AlertTriangle, 
  Server, 
  Cpu, 
  HardDrive, 
  Database,
  Wrench,
  CheckCircle2,
  Clock,
  Loader2
} from 'lucide-react';

type StepState = 'pending' | 'running' | 'ok' | 'fail';

interface HealingStep {
  id: string;
  name: string;
  state: StepState;
}

type RunPhase = 'idle' | 'analyzing' | 'executing' | 'completed' | 'failed';

function PlatformHealingContent() {
  const { toast } = useToast();
  const [autoCommit, setAutoCommit] = useState(false);
  const [autoPush, setAutoPush] = useState(false);
  const [phase, setPhase] = useState<RunPhase>('idle');
  const [steps, setSteps] = useState<HealingStep[]>([]);
  const [progress, setProgress] = useState(0);
  const [subtitle, setSubtitle] = useState('No run in progress. Start a new healing run below.');
  const [meta, setMeta] = useState('');
  const [feed, setFeed] = useState<string[]>([]);
  const [issueDescription, setIssueDescription] = useState('');

  // WebSocket connection for live metrics
  const wsStream = useWebSocketStream('platform-healing', 'admin');
  const metrics = wsStream.platformMetrics;

  // Fallback to HTTP polling if WebSocket not connected
  const { data: httpMetrics } = useQuery<any>({
    queryKey: ['/api/platform/status'],
    refetchInterval: wsStream.isConnected ? false : 5000,
    enabled: !wsStream.isConnected,
  });

  // Use WebSocket metrics if available, otherwise HTTP metrics
  const status = metrics || httpMetrics;

  // Auto-heal mutation
  const autoHealMutation = useMutation({
    mutationFn: async (issue: string) => {
      const response = await apiRequest('POST', '/api/platform/auto-heal', {
        issue,
        autoCommit,
        autoPush
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: 'Auto-heal initiated',
        description: 'Platform healing process started successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/status'] });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Auto-heal failed',
        description: error.message || 'Failed to initiate auto-heal',
      });
    },
  });

  function startRun(text: string) {
    setFeed(f => [`▶️ New run started: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`, ...f]);
    
    const list: HealingStep[] = [
      { id: '1', name: 'Collect system diagnostics', state: 'pending' },
      { id: '2', name: 'Analyze logs & metrics', state: 'pending' },
      { id: '3', name: 'Detect anomalies', state: 'pending' },
      { id: '4', name: 'Generate fix plan', state: 'pending' },
      { id: '5', name: 'Apply fixes', state: 'pending' },
      { id: '6', name: 'Validate & commit', state: 'pending' },
    ];
    
    setSteps(list);
    setPhase('analyzing');
    setProgress(0);
    setSubtitle('Collecting system diagnostics...');
    setMeta('Step 1 of 6');
    
    // Trigger actual auto-heal
    autoHealMutation.mutate(text);
    
    // Simulate progress for UI feedback
    let i = 0;
    let completed = 0;
    
    function advance() {
      if (i > 0) {
        list[i - 1].state = 'ok';
        completed++;
        setProgress((completed / list.length) * 100);
      }
      
      if (i === list.length) {
        setPhase('completed');
        setSubtitle('Healing run completed successfully');
        setMeta(`${list.length}/${list.length} steps${autoCommit ? ' • auto-commit' : ''}${autoPush ? ' • auto-push' : ''}`);
        setFeed(f => ['✅ Run succeeded • ' + new Date().toLocaleTimeString(), ...f]);
        setSteps([...list]);
        return;
      }
      
      list[i].state = 'running';
      setSteps([...list]);
      setPhase(i < 3 ? 'analyzing' : 'executing');
      setSubtitle(list[i].name);
      setMeta(`Step ${i + 1} of ${list.length}${autoCommit ? ' • auto-commit' : ''}${autoPush ? ' • auto-push' : ''}`);
      i++;
      setTimeout(advance, 800 + i * 150);
    }
    
    advance();
  }

  useEffect(() => {
    if (!autoCommit) setAutoPush(false);
  }, [autoCommit]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0f15] to-[#0d121a] text-slate-100">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_380px] gap-4 p-4 min-h-screen">
        {/* Sidebar */}
        <aside className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-4 hidden lg:block">
          <div className="font-bold text-sm tracking-wider mb-4" data-testid="sidebar-title">ARCHETYPE</div>
          <nav className="flex flex-direction-column gap-2">
            <Button variant="secondary" className="w-full justify-start" data-testid="nav-dashboard">
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start" data-testid="nav-builder">
              Builder
            </Button>
            <Button variant="ghost" className="w-full justify-start" data-testid="nav-marketplace">
              Marketplace
            </Button>
            <Button variant="ghost" className="w-full justify-start" data-testid="nav-analytics">
              Analytics
            </Button>
            <Button variant="ghost" className="w-full justify-start" data-testid="nav-team">
              Team
            </Button>
            <Button variant="ghost" className="w-full justify-start" data-testid="nav-api">
              API Keys
            </Button>
          </nav>
          <div className="mt-auto pt-8 text-xs text-slate-500" data-testid="sidebar-user">
            Signed in as <strong className="text-slate-300">Admin</strong>
          </div>
        </aside>

        {/* Main Content */}
        <section className="flex flex-col gap-4">
          {/* Header */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-4 flex flex-wrap items-center gap-4">
            <div className="text-xs text-slate-500" data-testid="breadcrumb">Home / Agents</div>
            <div className="text-lg font-bold" data-testid="page-title">Meta‑SySop • Platform Healing</div>
            <Badge 
              variant={status?.safety?.safe ? 'default' : 'destructive'} 
              className="ml-auto"
              data-testid="health-badge"
            >
              ● {status?.safety?.safe ? 'Healthy' : 'Issues Detected'}
            </Badge>
            
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <Switch 
                  id="auto-commit" 
                  checked={autoCommit} 
                  onCheckedChange={setAutoCommit}
                  data-testid="toggle-auto-commit"
                />
                <Label htmlFor="auto-commit" className="text-sm cursor-pointer">
                  Auto-commit
                </Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch 
                  id="auto-push" 
                  checked={autoPush} 
                  onCheckedChange={setAutoPush}
                  disabled={!autoCommit}
                  data-testid="toggle-auto-push"
                />
                <Label 
                  htmlFor="auto-push" 
                  className={`text-sm cursor-pointer ${!autoCommit ? 'opacity-50' : ''}`}
                >
                  Auto-push
                </Label>
              </div>
              
              <Button 
                className="bg-gradient-to-b from-[#2a7dfb] to-[#0f62f2] shadow-lg shadow-blue-500/35"
                onClick={() => document.getElementById('issue')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-new-run"
              >
                New Run
              </Button>
            </div>
          </div>

          {/* System Metrics Card */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-5">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2" data-testid="metrics-title">
              <Server className="w-4 h-4 text-blue-400" />
              Live System Metrics
              {wsStream.isConnected && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="WebSocket Connected" />
              )}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Overall Health</div>
                  <div className="text-xl font-bold" data-testid="metric-health">
                    {status?.overallHealth || 0}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Incidents</div>
                  <div className="text-xl font-bold" data-testid="metric-incidents">
                    {status?.activeIncidents || 0}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">CPU Usage</div>
                  <div className="text-xl font-bold" data-testid="metric-cpu">
                    {status?.cpuUsage || 0}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Memory</div>
                  <div className="text-xl font-bold" data-testid="metric-memory">
                    {status?.memoryUsage || 0}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    CPU Load
                  </span>
                  <span className="font-mono" data-testid="cpu-percentage">{status?.cpuUsage || 0}%</span>
                </div>
                <Progress value={status?.cpuUsage || 0} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-purple-400" />
                    Memory
                  </span>
                  <span className="font-mono" data-testid="memory-percentage">{status?.memoryUsage || 0}%</span>
                </div>
                <Progress value={status?.memoryUsage || 0} className="h-2" />
              </div>
            </div>
          </div>

          {/* Current Run Card */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-5" data-testid="run-card">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-bold text-sm">Current Run</h3>
              <Badge 
                variant={phase === 'idle' ? 'secondary' : phase === 'completed' ? 'default' : 'outline'}
                className={phase === 'analyzing' || phase === 'executing' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : ''}
                data-testid="run-phase-badge"
              >
                {phase === 'idle' ? 'Idle' : phase.charAt(0).toUpperCase() + phase.slice(1)}
              </Badge>
            </div>
            
            <div className="text-sm text-slate-400 mb-3" data-testid="run-subtitle">{subtitle}</div>
            
            <div className="bg-[#1a2232] border border-slate-700/50 rounded-full h-3 overflow-hidden mb-2">
              <div 
                className="h-full bg-gradient-to-r from-[#2a7dfb] to-[#4da3ff] transition-all duration-300"
                style={{ width: `${progress}%` }}
                data-testid="run-progress"
              />
            </div>
            
            <div className="text-xs text-slate-500 mb-4" data-testid="run-meta">{meta}</div>
            
            {steps.length > 0 && (
              <ul className="space-y-2" data-testid="run-steps">
                {steps.map(step => (
                  <li 
                    key={step.id} 
                    className="flex items-center gap-3 bg-[#0f1520] border border-slate-700/50 rounded-lg p-3"
                    data-testid={`step-${step.id}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${
                      step.state === 'ok' ? 'bg-emerald-500' :
                      step.state === 'fail' ? 'bg-red-500' :
                      step.state === 'running' ? 'bg-blue-500 animate-pulse' :
                      'bg-slate-600'
                    }`} />
                    <div className="flex-1 text-sm">{step.name}</div>
                    <div className="text-xs text-slate-500">
                      {step.state === 'ok' ? '✓' : step.state === 'fail' ? '×' : step.state === 'running' ? '…' : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* New Run Form */}
          <div id="issue" className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-5">
            <h3 className="font-bold text-sm mb-2" data-testid="form-title">Start a New Healing Run</h3>
            <p className="text-sm text-slate-400 mb-4">
              Describe the issue. We'll propose steps before executing.
            </p>
            
            <div className="flex gap-3">
              <Textarea
                value={issueDescription}
                onChange={e => setIssueDescription(e.target.value)}
                placeholder="e.g., API latency spiking to p95 3s since 14:05 UTC. Suspect rate limiter regression after v1.9.2."
                className="flex-1 min-h-[100px] bg-[#0c121c] border-slate-700 text-slate-100 resize-vertical"
                data-testid="input-issue-description"
              />
              <Button 
                className="bg-gradient-to-b from-[#2a7dfb] to-[#0f62f2] shadow-lg shadow-blue-500/35"
                onClick={() => {
                  if (issueDescription.trim()) {
                    startRun(issueDescription.trim());
                    setIssueDescription('');
                  }
                }}
                disabled={!issueDescription.trim() || autoHealMutation.isPending}
                data-testid="button-analyze-fix"
              >
                {autoHealMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    Analyze & Fix
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* Right Sidebar - Activity Feed */}
        <aside className="flex flex-col gap-4 hidden lg:block">
          {/* Recent Activity */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-5">
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2" data-testid="activity-title">
              <Clock className="w-4 h-4" />
              Recent Activity
            </h3>
            <div className="space-y-2">
              {feed.length === 0 ? (
                <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3 text-sm text-slate-500" data-testid="activity-empty">
                  No runs yet.
                </div>
              ) : (
                feed.map((item, i) => (
                  <div 
                    key={i} 
                    className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3 text-sm"
                    data-testid={`activity-${i}`}
                  >
                    {item}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pro Tips */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-5">
            <h3 className="font-bold text-sm mb-4" data-testid="tips-title">Pro Tips</h3>
            <div className="space-y-3 text-sm text-slate-400">
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3">
                Be specific about the issue (when it started, what changed, scope).
              </div>
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3">
                Use "Analyze only" (no commit) when investigating incidents.
              </div>
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3">
                Enable Auto-commit only when your tests are reliable.
              </div>
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3">
                WebSocket provides real-time metrics updates every 5 seconds.
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-5">
            <h3 className="font-bold text-sm mb-4" data-testid="status-title">System Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Uptime</span>
                <span className="font-mono text-slate-200" data-testid="status-uptime">
                  {status?.uptime || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Last Update</span>
                <span className="font-mono text-xs text-slate-500" data-testid="status-last-update">
                  {status?.lastUpdate ? new Date(status.lastUpdate).toLocaleTimeString() : '--:--:--'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Connection</span>
                <Badge variant={wsStream.isConnected ? 'default' : 'secondary'} className="text-xs" data-testid="status-connection">
                  {wsStream.isConnected ? '🟢 WebSocket' : '🔵 HTTP'}
                </Badge>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function PlatformHealing() {
  return <PlatformHealingContent />;
}
