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
import { AdminGuard } from '@/components/admin-guard';
import { DeploymentStatusWidget } from '@/components/deployment-status-widget';
import { TaskProgressWidget } from '@/components/task-progress-widget';
import { AgentTaskList, type AgentTask } from '@/components/agent-task-list';
import { Rocket } from 'lucide-react';

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
  const [metaTasks, setMetaTasks] = useState<AgentTask[]>([]);
  const [metaActiveTaskId, setMetaActiveTaskId] = useState<string | null>(null);

  // Force deploy mutation
  const forceDeployMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/force-deploy', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Force deploy: Clean platform-healing UI - minimal chat interface only'
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Deploy failed');
      }

      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: '🚀 Deploy Successful!',
        description: `Deployed ${data.filesDeployed} files. Railway will auto-deploy in 2-3 minutes.`,
      });
      console.log('[FORCE-DEPLOY] Success:', data);
    },
    onError: (error: any) => {
      toast({
        title: '❌ Deploy Failed',
        description: error.message || 'Failed to deploy changes',
        variant: 'destructive',
      });
      console.error('[FORCE-DEPLOY] Error:', error);
    },
  });

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

  // Fetch pending changes
  const { data: pendingChangesData, isLoading: pendingChangesLoading, refetch: refetchPendingChanges } = useQuery<any>({
    queryKey: ['/api/meta-sysop/pending-changes'],
    refetchInterval: 5000,
  });

  const [selectedFileForDiff, setSelectedFileForDiff] = useState<string | null>(null);
  const [showPendingChanges, setShowPendingChanges] = useState(true);

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
    <div className="flex-1 flex flex-col overflow-hidden bg-background p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:gap-4 h-full max-w-7xl mx-auto w-full">
        {/* Header - Clean and simple */}
        <div className="flex items-center gap-2 px-2 flex-wrap">
          <div className="text-xs text-muted-foreground">Home / Agents</div>
          <div className="text-base sm:text-lg font-bold">Meta‑SySop</div>
          <Badge 
            variant={status?.safety?.safe ? 'default' : 'destructive'} 
            className="ml-auto"
          >
            ● {status?.safety?.safe ? 'Healthy' : 'Issues'}
          </Badge>
          <Button
            size="sm"
            onClick={() => forceDeployMutation.mutate()}
            disabled={forceDeployMutation.isPending}
            className="bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
            data-testid="button-force-deploy"
          >
            {forceDeployMutation.isPending ? (
              <>Deploying...</>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-1" />
                Force Deploy
              </>
            )}
          </Button>
        </div>

        {/* Main Content Area - Chat + Task Manager */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 flex-1 min-h-0">
          {/* Left: Chat - 2 columns on desktop */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col min-h-0" data-testid="panel-meta-sysop-chat">
            <MetaSySopChat 
              autoCommit={true}
              autoPush={true}
              onTasksChange={(tasks, activeId) => {
                setMetaTasks(tasks);
                setMetaActiveTaskId(activeId);
              }}
            />
          </div>

          {/* Right: Task Manager - 1 column on desktop */}
          <div className="lg:col-span-1 flex flex-col gap-3 min-h-0" data-testid="panel-task-manager">
            {/* Task Manager Panel */}
            <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold" data-testid="heading-task-manager">Task Manager</h3>
              </div>
              <div className="flex-1 overflow-y-auto" data-testid="container-task-list">
                <AgentTaskList 
                  tasks={metaTasks} 
                  activeTaskId={metaActiveTaskId}
                />
              </div>
            </div>

            {/* Deployment Status Widget - Hidden on mobile for better UX */}
            <div className="hidden md:block">
              <DeploymentStatusWidget />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with admin guard
export default function PlatformHealing() {
  return (
    <AdminGuard>
      <PlatformHealingContent />
    </AdminGuard>
  );
}