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
import { MetaSySopChat } from '@/components/meta-sysop-chat';
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
  GitCommit,
  Package,
  ChevronDown,
  Sparkles,
  Paperclip,
  Infinity,
  SlidersHorizontal,
  ArrowUp,
  Shield,
  Zap,
  Brain,
  Lock,
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

  // Fetch autonomy level data
  const { data: autonomyData, isLoading: autonomyLoading } = useQuery<any>({
    queryKey: ['/api/meta-sysop/autonomy-level'],
    refetchInterval: false,
  });

  // Fetch pending changes
  const { data: pendingChangesData, isLoading: pendingChangesLoading, refetch: refetchPendingChanges } = useQuery<any>({
    queryKey: ['/api/meta-sysop/pending-changes'],
    refetchInterval: 5000,
  });

  const [selectedFileForDiff, setSelectedFileForDiff] = useState<string | null>(null);
  const [showPendingChanges, setShowPendingChanges] = useState(true);

  // Update autonomy level mutation
  const updateAutonomyMutation = useMutation({
    mutationFn: async (level: string) => {
      return await apiRequest('PUT', '/api/meta-sysop/autonomy-level', { level });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta-sysop/autonomy-level'] });
      toast({
        title: 'Autonomy level updated',
        description: 'Your Meta-SySop autonomy level has been updated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message || 'Failed to update autonomy level',
      });
    },
  });

  // Meta-SySop streaming mutation (NEW SYSTEM with all tools!)
  const autoHealMutation = useMutation({
    mutationFn: async (issue: string) => {
      setPhase('analyzing');
      setHealingMessages([{ 
        id: Date.now().toString(), 
        type: 'init', 
        text: 'Starting Meta-SySop...', 
        timestamp: new Date() 
      }]);

      const response = await fetch('/api/meta-sysop/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: issue }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response stream');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              console.log('[META-SYSOP] Event:', data.type, data);

              // Add to chat messages for ALL events
              if (data.type === 'content' && data.content) {
                // Conversational AI text - show as thought bubble with time-based aggregation
                setHealingMessages(prev => {
                  const last = prev[prev.length - 1];
                  const now = Date.now();
                  
                  // If last message is 'thought' and was created in last 30 seconds, APPEND to it
                  // 30 seconds handles even the longest streaming responses
                  if (last && last.type === 'thought' && (now - last.timestamp.getTime()) < 30000) {
                    return [...prev.slice(0, -1), {
                      ...last,
                      text: (last.text || '') + data.content,
                      timestamp: new Date()
                    }];
                  }
                  
                  // Otherwise create new message
                  return [...prev, {
                    id: now.toString(),
                    type: 'thought',
                    text: data.content,
                    timestamp: new Date()
                  }];
                });
              }
              
              if (data.type === 'progress' && data.message) {
                setHealingMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  type: 'thought',
                  text: data.message,
                  timestamp: new Date()
                }]);
                setFeed(f => [`📋 ${data.message}`, ...f]);
              }
              
              if (data.type === 'approval_requested') {
                setPhase('awaiting_approval');
                updateProgressStep('analyze', 'completed');
                updateProgressStep('approval', 'in_progress');
                setApprovalRequest({
                  messageId: data.messageId,
                  summary: data.summary,
                  filesChanged: data.filesChanged,
                  estimatedImpact: data.estimatedImpact,
                });
                setHealingMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  type: 'thought',
                  text: `🔔 Approval requested:\n\n${data.summary}`,
                  timestamp: new Date()
                }]);
              }
              
              if (data.type === 'file_change') {
                setFeed(f => [`📝 ${data.file.operation}: ${data.file.path}`, ...f]);
                setHealingMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  type: 'tool',
                  text: `${data.file.operation}: ${data.file.path}`,
                  timestamp: new Date()
                }]);
              }
            } catch (err) {
              console.error('[META-SYSOP] Parse error:', err);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      return { success: true };
    },
    onSuccess: () => {
      setPhase('completed');
      toast({ title: 'Complete', description: 'Meta-SySop finished' });
      queryClient.invalidateQueries({ queryKey: ['/api/platform/status'] });
    },
    onError: (error: any) => {
      setPhase('failed');
      toast({
        variant: 'destructive',
        title: 'Failed',
        description: error.message,
      });
    },
  });

  // Approve changes mutation
  const approveMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return await apiRequest('POST', `/api/meta-sysop/approve/${messageId}`, {
        sessionId: currentSessionId, // Pass sessionId to wire up the approval
      });
    },
    onSuccess: () => {
      setApprovalRequest(null);
      setPhase('building');
      updateProgressStep('approved', 'completed');
      updateProgressStep('building', 'in_progress');
      toast({
        title: 'Changes approved',
        description: 'Meta-SySop is continuing work...',
      });
      // No need to restart - the approval resolves the pending promise
      // and the original session continues automatically
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
      return await apiRequest('POST', `/api/meta-sysop/reject/${messageId}`, {
        sessionId: currentSessionId,
      });
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

  // Deploy All mutation - batch commit all pending changes
  const deployAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/meta-sysop/deploy-all', {});
    },
    onSuccess: (result: any) => {
      refetchPendingChanges();
      setSelectedFileForDiff(null);
      toast({
        title: 'Deployment successful!',
        description: `Successfully deployed ${result.filesDeployed} file(s)`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Deployment failed',
        description: error.message || 'Failed to deploy changes',
      });
    },
  });

  // Discard All mutation - clear all pending changes
  const discardAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', '/api/meta-sysop/discard-changes', {});
    },
    onSuccess: () => {
      refetchPendingChanges();
      setSelectedFileForDiff(null);
      toast({
        title: 'Changes discarded',
        description: 'All pending changes have been discarded',
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Discard failed',
        description: error.message || 'Failed to discard changes',
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
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 h-full overflow-y-auto max-w-[100vw] overflow-x-hidden">
        {/* Main Content */}
        <section className="flex flex-col gap-3 sm:gap-4 min-w-0 max-w-6xl mx-auto w-full">
          {/* Header */}
          <div className="bg-card border border-border rounded-xl shadow-lg p-3 sm:p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-muted-foreground" data-testid="breadcrumb">Home / Agents</div>
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
          <div className="bg-card border border-border rounded-xl shadow-lg p-3 sm:p-5 overflow-hidden">
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
                  <div className="text-xs text-muted-foreground truncate">Health</div>
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
                  <div className="text-xs text-muted-foreground truncate">Incidents</div>
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
                  <div className="text-xs text-muted-foreground truncate">CPU</div>
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
                  <div className="text-xs text-muted-foreground truncate">Memory</div>
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
            <div className="bg-card border border-border rounded-xl shadow-lg p-3 sm:p-4">
              <h3 className="font-bold text-sm mb-3" data-testid="progress-title">Build Progress</h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {progressSteps.map((step, index) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted border border-border">
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" data-testid={`step-icon-${step.id}-completed`} />
                      ) : step.status === 'in_progress' ? (
                        <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" data-testid={`step-icon-${step.id}-in_progress`} />
                      ) : step.status === 'failed' ? (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" data-testid={`step-icon-${step.id}-failed`} />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" data-testid={`step-icon-${step.id}-pending`} />
                      )}
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        step.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                        step.status === 'in_progress' ? 'text-blue-600 dark:text-blue-400' :
                        step.status === 'failed' ? 'text-destructive' :
                        'text-muted-foreground'
                      }`} data-testid={`step-label-${step.id}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < progressSteps.length - 1 && (
                      <div className="w-2 h-0.5 bg-border hidden sm:block" />
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
                  <p className="text-sm text-muted-foreground">Meta-SySop has analyzed the issue and prepared a solution. Please review and approve.</p>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-4 p-3 bg-muted border border-border rounded-lg">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Summary</h4>
                <p className="text-sm text-foreground break-words whitespace-pre-wrap" data-testid="text-approval-summary">
                  {approvalRequest.summary}
                </p>
              </div>

              {/* Files Changed */}
              <div className="mb-4 p-3 bg-muted border border-border rounded-lg">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Files to be Changed ({approvalRequest.filesChanged.length})
                </h4>
                <div className="space-y-1.5" data-testid="text-files-changed">
                  {approvalRequest.filesChanged.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm font-mono">
                      <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-foreground break-all">{file}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estimated Impact */}
              <div className="mb-5 p-3 bg-muted border border-border rounded-lg">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Estimated Impact</h4>
                <Badge 
                  variant={approvalRequest.estimatedImpact === 'low' ? 'default' : 
                          approvalRequest.estimatedImpact === 'high' ? 'destructive' : 'secondary'}
                  className="font-semibold"
                  data-testid="text-estimated-impact"
                >
                  {approvalRequest.estimatedImpact.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
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

          {/* Pending Changes Panel - Replit Agent Style */}
          {!pendingChangesLoading && pendingChangesData && pendingChangesData.count > 0 && (
            <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => setShowPendingChanges(!showPendingChanges)}
                className="w-full flex items-center justify-between p-4 sm:p-5 hover-elevate active-elevate-2"
                data-testid="button-toggle-pending-changes"
              >
                <div className="flex items-center gap-3">
                  <GitCommit className="w-5 h-5 text-yellow-400" />
                  <div className="text-left">
                    <h3 className="font-bold text-sm sm:text-base">
                      Pending Changes
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {pendingChangesData.count} file{pendingChangesData.count !== 1 ? 's' : ''} staged
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                    {pendingChangesData.count}
                  </Badge>
                  <ChevronDown className={`w-5 h-5 transition-transform ${showPendingChanges ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {showPendingChanges && (
                <div className="border-t border-border p-4 sm:p-5 space-y-4">
                  {/* File List */}
                  <div className="space-y-2">
                    {pendingChangesData.pendingChanges.map((change: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedFileForDiff(selectedFileForDiff === change.path ? null : change.path)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedFileForDiff === change.path
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-border hover-elevate active-elevate-2'
                        }`}
                        data-testid={`file-change-${idx}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <span className="font-mono text-xs truncate">{change.path}</span>
                          </div>
                          <Badge
                            variant={
                              change.operation === 'create' ? 'default' :
                              change.operation === 'modify' ? 'secondary' : 'destructive'
                            }
                            className="shrink-0"
                          >
                            {change.operation}
                          </Badge>
                        </div>

                        {selectedFileForDiff === change.path && change.oldContent && (
                          <div className="mt-3 border-t border-border pt-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="font-semibold text-muted-foreground mb-1">Before</p>
                                <pre className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs overflow-x-auto max-h-40">
                                  {change.oldContent.substring(0, 500)}{change.oldContent.length > 500 ? '...' : ''}
                                </pre>
                              </div>
                              <div>
                                <p className="font-semibold text-muted-foreground mb-1">After</p>
                                <pre className="p-2 bg-green-500/10 border border-green-500/20 rounded text-xs overflow-x-auto max-h-40">
                                  {change.newContent.substring(0, 500)}{change.newContent.length > 500 ? '...' : ''}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-semibold shadow-lg shadow-green-500/25"
                      onClick={() => deployAllMutation.mutate()}
                      disabled={deployAllMutation.isPending}
                      data-testid="button-deploy-all"
                    >
                      {deployAllMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Deploying...
                        </>
                      ) : (
                        <>
                          <GitCommit className="w-4 h-4 mr-2" />
                          Deploy All ({pendingChangesData.count})
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => discardAllMutation.mutate()}
                      disabled={discardAllMutation.isPending}
                      data-testid="button-discard-all"
                    >
                      {discardAllMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Discarding...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Discard All
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Autonomy Level Selector */}
          {!autonomyLoading && autonomyData && (
            <div className="bg-card border border-border rounded-xl shadow-lg p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm sm:text-base">Meta-SySop Autonomy Level</h3>
                <Badge variant="secondary" className="ml-auto">
                  {autonomyData.plan}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mb-4">
                Control how much autonomy Meta-SySop has when maintaining your platform. Higher tiers unlock advanced capabilities.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(autonomyData.levels).map(([levelId, levelData]: [string, any]) => {
                  const isCurrentLevel = autonomyData.currentLevel === levelId;
                  const levelToNumber: Record<string, number> = { basic: 0, standard: 1, deep: 2, max: 3 };
                  const maxToNumber: Record<string, number> = { basic: 0, standard: 1, deep: 2, max: 3 };
                  const isLocked = levelToNumber[levelId] > maxToNumber[autonomyData.maxAllowedLevel];
                  
                  const IconComponent = levelData.icon === 'shield' ? Shield :
                                       levelData.icon === 'zap' ? Zap :
                                       levelData.icon === 'brain' ? Brain : Infinity;

                  return (
                    <button
                      key={levelId}
                      onClick={() => {
                        if (!isLocked && !updateAutonomyMutation.isPending) {
                          updateAutonomyMutation.mutate(levelId);
                        }
                      }}
                      disabled={isLocked || updateAutonomyMutation.isPending}
                      className={`relative p-4 rounded-lg border-2 transition-all text-left ${
                        isCurrentLevel
                          ? 'border-blue-500 bg-blue-500/10'
                          : isLocked
                          ? 'border-border bg-muted/50 opacity-60 cursor-not-allowed'
                          : 'border-border bg-card hover-elevate active-elevate-2 cursor-pointer'
                      }`}
                      data-testid={`autonomy-level-${levelId}`}
                    >
                      {isLocked && (
                        <div className="absolute top-2 right-2">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 mb-2">
                        <IconComponent className={`w-5 h-5 ${
                          isCurrentLevel ? 'text-blue-500' : 'text-muted-foreground'
                        }`} />
                        <h4 className="font-bold text-sm">{levelData.name}</h4>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-3">
                        {levelData.description}
                      </p>
                      
                      <div className="space-y-1">
                        {levelData.features.slice(0, 2).map((feature: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-xs text-foreground/80">{feature}</span>
                          </div>
                        ))}
                        {levelData.features.length > 2 && (
                          <span className="text-xs text-muted-foreground">
                            +{levelData.features.length - 2} more
                          </span>
                        )}
                      </div>

                      {isLocked && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <span className="text-xs text-muted-foreground">
                            Requires: {levelData.requiredPlan}
                          </span>
                        </div>
                      )}
                      
                      {isCurrentLevel && (
                        <div className="mt-3 pt-3 border-t border-blue-500/30">
                          <Badge variant="default" className="text-xs">
                            Active
                          </Badge>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meta-SySop Chat - Full Chatroom Interface */}
          <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col" style={{ height: '600px' }} data-testid="chat-card">
            <MetaSySopChat 
              autoCommit={true}
              autoPush={true}
            />
          </div>
        </section>
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
