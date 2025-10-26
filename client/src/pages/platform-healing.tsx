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
import { PlatformHealingChat } from '@/components/platform-healing-chat';
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
  Loader2,
  XCircle,
  FileText,
  GitCommit
} from 'lucide-react';

type StepState = 'pending' | 'running' | 'ok' | 'fail';

interface HealingStep {
  id: string;
  name: string;
  state: StepState;
}

type RunPhase = 'idle' | 'analyzing' | 'awaiting_approval' | 'executing' | 'building' | 'committing' | 'completed' | 'failed';

interface HealMessage {
  id: string;
  type: 'init' | 'thought' | 'tool' | 'write-pending' | 'approved' | 'rejected' | 'completed' | 'error';
  text?: string;
  path?: string;
  directory?: string;
  diff?: string;
  timestamp: Date;
  sessionId?: string;
}

interface ApprovalRequest {
  messageId: string;
  summary: string;
  filesChanged: string[];
  estimatedImpact: string;
}

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

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
  const [healingMessages, setHealingMessages] = useState<HealMessage[]>([]);
  const [pendingWrite, setPendingWrite] = useState<{ path: string; diff: string; sessionId: string } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [approvalRequest, setApprovalRequest] = useState<ApprovalRequest | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: 'analyze', label: 'Analyzed', status: 'pending' },
    { id: 'approval', label: 'Awaiting approval', status: 'pending' },
    { id: 'approved', label: 'Approved', status: 'pending' },
    { id: 'building', label: 'Building changes', status: 'pending' },
    { id: 'committing', label: 'Committing to GitHub', status: 'pending' },
    { id: 'deployed', label: 'Deployed', status: 'pending' },
  ]);

  // WebSocket connection for live metrics and heal events
  const wsStream = useWebSocketStream('platform-healing', 'admin');
  const metrics = wsStream.platformMetrics;
  const { healEvents } = wsStream;

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
      const response = await apiRequest('POST', '/api/platform/heal', {
        issue,
        autoCommit,
        autoPush
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Auto-heal initiated',
        description: 'Platform healing process started successfully',
      });
      if (data.sessionId) {
        setCurrentSessionId(data.sessionId);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/platform/status'] });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Auto-heal failed',
        description: error.message || 'Failed to initiate auto-heal',
      });
      setPhase('failed');
    },
  });

  // Approve changes mutation
  const approveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest('POST', `/api/meta-sysop/approve/${messageId}`, {});
    },
    onSuccess: () => {
      setApprovalRequest(null);
      setPhase('building');
      updateProgressStep('approved', 'completed');
      updateProgressStep('building', 'in_progress');
      toast({
        title: 'Changes approved',
        description: 'Meta-SySop will now build and deploy your changes',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Approval failed',
        description: error.message || 'Failed to approve changes',
      });
    },
  });

  // Reject changes mutation
  const rejectMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest('POST', `/api/meta-sysop/reject/${messageId}`, {});
    },
    onSuccess: () => {
      setApprovalRequest(null);
      setPhase('idle');
      updateProgressStep('approval', 'failed');
      toast({
        title: 'Changes rejected',
        description: 'Meta-SySop will not proceed with these changes',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Rejection failed',
        description: error.message || 'Failed to reject changes',
      });
    },
  });

  // Helper function to update progress steps
  const updateProgressStep = (stepId: string, status: ProgressStep['status']) => {
    setProgressSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status } : step
    ));
  };

  function startRun(text: string) {
    // Reset healing state
    setHealingMessages([]);
    setPendingWrite(null);
    setCurrentSessionId(null);
    setApprovalRequest(null);
    setPhase('analyzing');
    setFeed(f => [`▶️ New run started: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`, ...f]);
    
    // Reset progress steps
    setProgressSteps([
      { id: 'analyze', label: 'Analyzed', status: 'in_progress' },
      { id: 'approval', label: 'Awaiting approval', status: 'pending' },
      { id: 'approved', label: 'Approved', status: 'pending' },
      { id: 'building', label: 'Building changes', status: 'pending' },
      { id: 'committing', label: 'Committing to GitHub', status: 'pending' },
      { id: 'deployed', label: 'Deployed', status: 'pending' },
    ]);
    
    // Trigger actual auto-heal (will set sessionId in onSuccess)
    autoHealMutation.mutate(text);
  }

  useEffect(() => {
    if (!autoCommit) setAutoPush(false);
  }, [autoCommit]);

  // NEW: Consume healEvents from the hook and populate UI state
  useEffect(() => {
    if (healEvents.length === 0) return;

    // Process the latest heal event
    const latestEvent = healEvents[healEvents.length - 1];
    
    // Handle approval_requested event separately
    if (latestEvent.type === 'approval_requested') {
      setPhase('awaiting_approval');
      updateProgressStep('analyze', 'completed');
      updateProgressStep('approval', 'in_progress');
      
      setApprovalRequest({
        messageId: latestEvent.messageId || '',
        summary: latestEvent.summary || '',
        filesChanged: Array.isArray(latestEvent.filesChanged) ? latestEvent.filesChanged : [],
        estimatedImpact: latestEvent.estimatedImpact || 'medium',
      });
      
      setFeed(f => [`🔔 Approval requested • ${new Date().toLocaleTimeString()}`, ...f]);
      return;
    }

    // Handle progress events
    if (latestEvent.type === 'progress') {
      const message = latestEvent.message || '';
      setFeed(f => [`📋 ${message} • ${new Date().toLocaleTimeString()}`, ...f]);
      
      // Update progress based on message content
      if (message.includes('Committing') || message.includes('Committed')) {
        updateProgressStep('building', 'completed');
        updateProgressStep('committing', 'in_progress');
        setPhase('committing');
      } else if (message.includes('deploy') || message.includes('Deploy')) {
        updateProgressStep('committing', 'completed');
        updateProgressStep('deployed', 'in_progress');
      }
      return;
    }

    const eventType = latestEvent.type?.replace('heal:', '') as HealMessage['type'];

    // Create heal message for chat UI
    const healMsg: HealMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type: eventType,
      text: latestEvent.text || latestEvent.message,
      path: latestEvent.path,
      directory: latestEvent.directory,
      diff: latestEvent.diff,
      timestamp: new Date(),
      sessionId: latestEvent.sessionId,
    };

    setHealingMessages(prev => [...prev, healMsg]);

    // Update phase and state based on event type
    switch (latestEvent.type) {
      case 'heal:init':
        setPhase('analyzing');
        setCurrentSessionId(latestEvent.sessionId || '');
        setFeed(f => [`▶️ Healing started: ${latestEvent.text}`, ...f]);
        break;

      case 'heal:thought':
        // Just add to messages, no phase change needed
        break;

      case 'heal:tool':
        // Just add to messages, no phase change needed
        break;

      case 'heal:write-pending':
        setPhase('executing');
        setPendingWrite({
          path: latestEvent.path || '',
          diff: latestEvent.diff || '',
          sessionId: latestEvent.sessionId || currentSessionId || '',
        });
        break;

      case 'heal:approved':
        setPendingWrite(null);
        setFeed(f => [`✅ Change approved • ${new Date().toLocaleTimeString()}`, ...f]);
        break;

      case 'heal:rejected':
        setPendingWrite(null);
        setFeed(f => [`❌ Change rejected • ${new Date().toLocaleTimeString()}`, ...f]);
        break;

      case 'heal:completed':
        setPhase('completed');
        updateProgressStep('deployed', 'completed');
        setFeed(f => [`✅ Healing completed • ${new Date().toLocaleTimeString()}`, ...f]);
        break;

      case 'heal:error':
        setPhase('failed');
        setProgressSteps(prev => prev.map(step => 
          step.status === 'in_progress' ? { ...step, status: 'failed' as const } : step
        ));
        setFeed(f => [`❌ Healing failed: ${latestEvent.error || 'Unknown error'} • ${new Date().toLocaleTimeString()}`, ...f]);
        break;
    }
  }, [healEvents, currentSessionId]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#0b0f15] to-[#0d121a] text-slate-100">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 p-3 sm:p-4 h-full overflow-y-auto max-w-[100vw] overflow-x-hidden">
        {/* Main Content */}
        <section className="flex flex-col gap-3 sm:gap-4 min-w-0">
          {/* Header */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-slate-500" data-testid="breadcrumb">Home / Agents</div>
                <div className="text-base sm:text-lg font-bold break-words" data-testid="page-title">
                  Meta‑SySop • Platform Healing
                </div>
                <Badge 
                  variant={status?.safety?.safe ? 'default' : 'destructive'} 
                  className="ml-auto shrink-0"
                  data-testid="health-badge"
                >
                  ● {status?.safety?.safe ? 'Healthy' : 'Issues'}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch 
                    id="auto-commit" 
                    checked={autoCommit} 
                    onCheckedChange={setAutoCommit}
                    data-testid="toggle-auto-commit"
                  />
                  <Label htmlFor="auto-commit" className="text-xs sm:text-sm cursor-pointer whitespace-nowrap">
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
                    className={`text-xs sm:text-sm cursor-pointer whitespace-nowrap ${!autoCommit ? 'opacity-50' : ''}`}
                  >
                    Auto-push
                  </Label>
                </div>
                
                <Button 
                  size="sm"
                  className="bg-gradient-to-b from-[#2a7dfb] to-[#0f62f2] shadow-lg shadow-blue-500/35 ml-auto"
                  onClick={() => document.getElementById('issue')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-new-run"
                >
                  New Run
                </Button>
              </div>
            </div>
          </div>

          {/* System Metrics Card */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-3 sm:p-5 overflow-hidden">
            <h3 className="font-bold text-sm mb-3 sm:mb-4 flex items-center gap-2 flex-wrap" data-testid="metrics-title">
              <Server className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Live System Metrics</span>
              {wsStream.isConnected && (
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="WebSocket Connected" />
              )}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="text-xs text-slate-500 truncate">Health</div>
                  <div className="text-lg sm:text-xl font-bold truncate" data-testid="metric-health">
                    {status?.overallHealth || 0}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="text-xs text-slate-500 truncate">Incidents</div>
                  <div className="text-lg sm:text-xl font-bold truncate" data-testid="metric-incidents">
                    {status?.activeIncidents || 0}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="text-xs text-slate-500 truncate">CPU</div>
                  <div className="text-lg sm:text-xl font-bold truncate" data-testid="metric-cpu">
                    {status?.cpuUsage || 0}%
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <div className="text-xs text-slate-500 truncate">Memory</div>
                  <div className="text-lg sm:text-xl font-bold truncate" data-testid="metric-memory">
                    {status?.memoryUsage || 0}%
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <Cpu className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="truncate">CPU Load</span>
                  </span>
                  <span className="font-mono shrink-0" data-testid="cpu-percentage">{status?.cpuUsage || 0}%</span>
                </div>
                <Progress value={status?.cpuUsage || 0} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs sm:text-sm gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <HardDrive className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="truncate">Memory</span>
                  </span>
                  <span className="font-mono shrink-0" data-testid="memory-percentage">{status?.memoryUsage || 0}%</span>
                </div>
                <Progress value={status?.memoryUsage || 0} className="h-2" />
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          {phase !== 'idle' && (
            <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-3 sm:p-4">
              <h3 className="font-bold text-sm mb-3" data-testid="progress-title">Build Progress</h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {progressSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#0c121c] border border-slate-700/50">
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" data-testid={`step-icon-${step.id}-completed`} />
                      ) : step.status === 'in_progress' ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" data-testid={`step-icon-${step.id}-in_progress`} />
                      ) : step.status === 'failed' ? (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" data-testid={`step-icon-${step.id}-failed`} />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" data-testid={`step-icon-${step.id}-pending`} />
                      )}
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        step.status === 'completed' ? 'text-emerald-400' :
                        step.status === 'in_progress' ? 'text-blue-300' :
                        step.status === 'failed' ? 'text-red-400' :
                        'text-slate-500'
                      }`} data-testid={`step-label-${step.id}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < progressSteps.length - 1 && (
                      <div className="w-2 h-0.5 bg-slate-700 hidden sm:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Request Card */}
          {approvalRequest && (
            <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-xl shadow-2xl p-4 sm:p-5 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base mb-1" data-testid="approval-title">Approval Required</h3>
                  <p className="text-sm text-slate-400">Meta-SySop has analyzed the issue and prepared a solution. Please review and approve.</p>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-4 p-3 bg-[#0c121c] border border-slate-700/50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Summary</h4>
                <p className="text-sm text-slate-200 break-words whitespace-pre-wrap" data-testid="text-approval-summary">
                  {approvalRequest.summary}
                </p>
              </div>

              {/* Files Changed */}
              <div className="mb-4 p-3 bg-[#0c121c] border border-slate-700/50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Files to be Changed ({approvalRequest.filesChanged.length})
                </h4>
                <div className="space-y-1.5" data-testid="text-files-changed">
                  {approvalRequest.filesChanged.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-mono">
                      <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-slate-300 break-all">{file}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estimated Impact */}
              <div className="mb-5 p-3 bg-[#0c121c] border border-slate-700/50 rounded-lg">
                <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Estimated Impact</h4>
                <Badge 
                  variant={approvalRequest.estimatedImpact === 'low' ? 'default' : 
                          approvalRequest.estimatedImpact === 'high' ? 'destructive' : 'secondary'}
                  className="font-semibold"
                  data-testid="text-estimated-impact"
                >
                  {approvalRequest.estimatedImpact.toUpperCase()}
                </Badge>
                <p className="text-xs text-slate-500 mt-2">
                  {approvalRequest.estimatedImpact === 'low' && 'Minor changes with low risk'}
                  {approvalRequest.estimatedImpact === 'medium' && 'Moderate changes that may affect features'}
                  {approvalRequest.estimatedImpact === 'high' && 'Significant changes requiring careful review'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold shadow-lg shadow-emerald-500/25"
                  size="lg"
                  onClick={() => approveMutation.mutate(approvalRequest.messageId)}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-changes"
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve & Build
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 font-semibold shadow-lg shadow-red-500/25"
                  size="lg"
                  onClick={() => rejectMutation.mutate(approvalRequest.messageId)}
                  disabled={rejectMutation.isPending}
                  data-testid="button-reject-changes"
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Healing Chat Card */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '500px' }} data-testid="chat-card">
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-slate-800/50 flex-wrap">
              <h3 className="font-bold text-sm">Meta-SySop Chat</h3>
              <Badge 
                variant={phase === 'idle' ? 'secondary' : phase === 'completed' ? 'default' : 'outline'}
                className={`${phase === 'analyzing' || phase === 'executing' ? 'bg-blue-500/10 text-blue-300 border-blue-500/30' : ''} shrink-0`}
                data-testid="run-phase-badge"
              >
                {phase === 'idle' ? 'Idle' : phase.charAt(0).toUpperCase() + phase.slice(1)}
              </Badge>
            </div>
            
            <PlatformHealingChat
              messages={healingMessages}
              pendingWrite={pendingWrite}
              onApprove={(sessionId) => approveMutation.mutate(sessionId)}
              onReject={(sessionId) => rejectMutation.mutate(sessionId)}
              isLoading={autoHealMutation.isPending}
            />
          </div>

          {/* New Run Form */}
          <div id="issue" className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-3 sm:p-5 overflow-hidden">
            <h3 className="font-bold text-sm mb-2" data-testid="form-title">Start a New Healing Run</h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4 break-words">
              Describe the issue. We'll propose steps before executing.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Textarea
                value={issueDescription}
                onChange={e => setIssueDescription(e.target.value)}
                placeholder="e.g., API latency spiking to p95 3s since 14:05 UTC. Suspect rate limiter regression after v1.9.2."
                className="flex-1 min-h-[100px] sm:min-h-[120px] bg-[#0c121c] border-slate-700 text-slate-100 resize-vertical text-sm"
                data-testid="input-issue-description"
              />
              <Button 
                className="bg-gradient-to-b from-[#2a7dfb] to-[#0f62f2] shadow-lg shadow-blue-500/35 sm:self-start shrink-0"
                size="default"
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
                    <span className="hidden sm:inline">Running...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Wrench className="w-4 h-4 mr-2" />
                    <span className="whitespace-nowrap">Analyze & Fix</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* Right Sidebar - Activity Feed (Desktop only) */}
        <aside className="flex flex-col gap-3 sm:gap-4 hidden lg:block">
          {/* Recent Activity */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-4 sm:p-5 overflow-hidden">
            <h3 className="font-bold text-sm mb-3 sm:mb-4 flex items-center gap-2" data-testid="activity-title">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Recent Activity</span>
            </h3>
            <div className="space-y-2">
              {feed.length === 0 ? (
                <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3 text-sm text-slate-500 break-words" data-testid="activity-empty">
                  No runs yet.
                </div>
              ) : (
                feed.map((item, i) => (
                  <div 
                    key={i} 
                    className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-3 text-sm break-words"
                    data-testid={`activity-${i}`}
                  >
                    {item}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pro Tips */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-4 sm:p-5 overflow-hidden">
            <h3 className="font-bold text-sm mb-3 sm:mb-4" data-testid="tips-title">Pro Tips</h3>
            <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-slate-400">
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-2.5 sm:p-3 break-words">
                Be specific about the issue (when it started, what changed, scope).
              </div>
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-2.5 sm:p-3 break-words">
                Use "Analyze only" (no commit) when investigating incidents.
              </div>
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-2.5 sm:p-3 break-words">
                Enable Auto-commit only when your tests are reliable.
              </div>
              <div className="bg-[#0f1520] border border-slate-700/50 rounded-lg p-2.5 sm:p-3 break-words">
                WebSocket provides real-time metrics updates every 5 seconds.
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-[#141924] border border-slate-800/50 rounded-xl shadow-2xl p-4 sm:p-5 overflow-hidden">
            <h3 className="font-bold text-sm mb-3 sm:mb-4" data-testid="status-title">System Status</h3>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400 truncate">Uptime</span>
                <span className="font-mono text-slate-200 shrink-0" data-testid="status-uptime">
                  {status?.uptime || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400 truncate">Last Update</span>
                <span className="font-mono text-xs text-slate-500 shrink-0" data-testid="status-last-update">
                  {status?.lastUpdate ? new Date(status.lastUpdate).toLocaleTimeString() : '--:--:--'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400 truncate">Connection</span>
                <Badge variant={wsStream.isConnected ? 'default' : 'secondary'} className="text-xs shrink-0" data-testid="status-connection">
                  {wsStream.isConnected ? '🟢 WS' : '🔵 HTTP'}
                </Badge>
              </div>
            </div>
          </div>
        </aside>
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
  return <PlatformHealingContent />;
}
