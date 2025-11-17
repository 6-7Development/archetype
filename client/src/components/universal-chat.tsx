import { useState, useRef, useEffect, useMemo, useReducer } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Key, AlertCircle, Square, ChevronDown, Copy, Check, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AgentProgress, type ProgressStep, type ProgressMetrics } from "@/components/agent-progress";
import { useWebSocketStream } from "@/hooks/use-websocket-stream";
import { ConnectionStatus } from "@/components/connection-status";
import { nanoid } from "nanoid";
import CostPreview from "@/components/cost-preview";
import { ChangesPanel } from "@/components/changes-panel";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { AgentTaskList, type AgentTask } from "@/components/agent-task-list";
import { AgentProgressDisplay } from "@/components/agent-progress-display";
import { RunProgressTable } from "@/components/run-progress-table";
import { ChatInputToolbar } from "@/components/ui/chat-input-toolbar";
import { AIModelSelector } from "@/components/ai-model-selector";
import { parseMessageContent, cleanAIResponse } from "@/lib/message-parser";
import { ScratchpadDisplay } from "@/components/scratchpad-display";
import { ArchitectNotesPanel } from "@/components/architect-notes-panel";
import { DeploymentStatusModal } from "@/components/deployment-status-modal";
import { StatusStrip } from "@/components/agent/StatusStrip";
import { ArtifactsDrawer, type Artifact as ArtifactItem } from "@/components/agent/ArtifactsDrawer";
import { EnhancedMessageDisplay } from "@/components/enhanced-message-display";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ContextRail } from "@/components/chat/ContextRail";
import { MessageHistory } from "@/components/chat/MessageHistory";
import type { 
  RunPhase, 
  RunState, 
  Task as RunTask, 
  RunStartedData, 
  RunStateUpdateData, 
  TaskCreatedData, 
  TaskUpdatedData, 
  RunCompletedData, 
  RunFailedData 
} from "@shared/agentEvents";

interface CheckpointData {
  complexity: string;
  cost: number;
  estimatedTime: string;
  actions: string[];
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  id?: string;              // REQUIRED for rendering - prevents crashes
  messageId?: string;       // REQUIRED for rendering - prevents crashes
  source?: string;          // Optional - identifies message origin
  progressSteps?: ProgressStep[];
  checkpoint?: CheckpointData;
  isSummary?: boolean;
  images?: string[];
  progressMessages?: Array<{ 
    id: string; 
    message: string; 
    timestamp: number;
    category?: 'thinking' | 'action' | 'result';
  }>; // Store thinking/tool calls inline
}

interface RequiredSecret {
  key: string;
  description: string;
  getInstructions?: string;
}

interface SecretsRequest {
  commandId: string;
  command: string;
  message: string;
  requiredSecrets: RequiredSecret[];
}

export interface UniversalChatProps {
  targetContext: 'platform' | 'project';
  projectId?: string | null;
  onProjectGenerated?: (result: any) => void;
}

// ============================================================================
// RUNSTATE REDUCER (Single Source of Truth for Agent Progress)
// ============================================================================

interface RunStateReducerState {
  runs: Map<string, RunState>;
  currentRunId: string | null;
}

type RunStateAction = 
  | { type: 'run.started'; data: RunStartedData }
  | { type: 'run.state_updated'; data: RunStateUpdateData }
  | { type: 'task.created'; data: TaskCreatedData }
  | { type: 'task.updated'; data: TaskUpdatedData }
  | { type: 'run.completed'; data: RunCompletedData }
  | { type: 'run.failed'; data: RunFailedData };

function runStateReducer(state: RunStateReducerState, action: RunStateAction): RunStateReducerState {
  const newState = { ...state, runs: new Map(state.runs) };
  
  switch (action.type) {
    case 'run.started':
      // Create new run state
      newState.runs.set(action.data.runId, {
        runId: action.data.runId,
        sessionId: action.data.sessionId,
        userId: action.data.userId,
        phase: 'thinking',
        status: 'active',
        tasks: [],
        currentTaskId: null,
        metrics: {
          totalTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalToolCalls: 0,
          currentIteration: 0,
          maxIterations: action.data.config.maxIterations,
        },
        startedAt: action.data.timestamp,
        lastActivityAt: action.data.timestamp,
        config: action.data.config,
        errors: [],
      });
      newState.currentRunId = action.data.runId;
      break;
      
    case 'run.state_updated':
      const run = newState.runs.get(action.data.runId);
      if (run) {
        if (action.data.phase) run.phase = action.data.phase;
        if (action.data.status) run.status = action.data.status;
        if (action.data.currentTaskId !== undefined) run.currentTaskId = action.data.currentTaskId;
        if (action.data.metricsUpdate) {
          run.metrics = { ...run.metrics, ...action.data.metricsUpdate };
        }
        if (action.data.error) run.errors.push(action.data.error);
        run.lastActivityAt = new Date().toISOString();
      }
      break;
      
    case 'task.created':
      // Find the appropriate run for this task
      // If task.id has runId prefix (e.g., "run123-task1"), extract it
      // Otherwise, assign to current run
      let targetRun: RunState | undefined;
      const taskIdParts = action.data.task.id.split('-');
      if (taskIdParts.length > 1 && newState.runs.has(taskIdParts[0])) {
        targetRun = newState.runs.get(taskIdParts[0]);
      } else if (newState.currentRunId) {
        targetRun = newState.runs.get(newState.currentRunId);
      }
      
      if (targetRun) {
        targetRun.tasks.push(action.data.task);
        targetRun.metrics.totalTasks++;
      }
      break;
      
    case 'task.updated':
      // Find run containing this task and update it
      newState.runs.forEach((run) => {
        const taskIndex = run.tasks.findIndex((t: RunTask) => t.id === action.data.taskId);
        if (taskIndex >= 0) {
          if (action.data.status) {
            const oldStatus = run.tasks[taskIndex].status;
            run.tasks[taskIndex].status = action.data.status;
            if (action.data.status === 'done' && oldStatus !== 'done') {
              run.metrics.completedTasks++;
            } else if (action.data.status === 'blocked') {
              run.metrics.failedTasks++;
            }
          }
          if (action.data.verification) run.tasks[taskIndex].verification = action.data.verification;
          if (action.data.artifacts) run.tasks[taskIndex].artifacts = action.data.artifacts;
          run.tasks[taskIndex].updatedAt = new Date().toISOString();
        }
      });
      break;
      
    case 'run.completed':
      const completedRun = newState.runs.get(action.data.runId);
      if (completedRun) {
        completedRun.status = 'completed';
        completedRun.phase = 'complete';
        completedRun.completedAt = action.data.timestamp;
      }
      break;
      
    case 'run.failed':
      const failedRun = newState.runs.get(action.data.runId);
      if (failedRun) {
        failedRun.status = 'failed';
        failedRun.errors.push({
          timestamp: action.data.timestamp,
          message: action.data.errorMessage,
          phase: action.data.phase,
          taskId: action.data.taskId,
        });
      }
      break;
  }
  
  return newState;
}

export function UniversalChat({ 
  targetContext, 
  projectId,
  onProjectGenerated 
}: UniversalChatProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copiedChatHistory, setCopiedChatHistory] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<Map<string, boolean>>(new Map());
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [secretsRequest, setSecretsRequest] = useState<SecretsRequest | null>(null);
  const [secretsInput, setSecretsInput] = useState<Record<string, string>>({});
  const [lastCommand, setLastCommand] = useState<string>("");
  const [currentProgress, setCurrentProgress] = useState<ProgressStep[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ProgressMetrics>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastChanges, setLastChanges] = useState<{
    created: string[];
    modified: string[];
    deleted: string[];
    summary: string;
  } | null>(null);

  // Agent UI state
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<'thinking' | 'working' | 'vibing' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [showTaskList, setShowTaskList] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<RunPhase>('complete');
  const [phaseMessage, setPhaseMessage] = useState<string>('');
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [showArtifactsDrawer, setShowArtifactsDrawer] = useState(false);

  // Deployment modal state
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);

  // Mobile drawer state
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Billing state
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [isFreeAccess, setIsFreeAccess] = useState<boolean>(false);

  // Billing metrics for real-time cost tracking
  const [billingMetrics, setBillingMetrics] = useState({
    inputTokens: 0,
    outputTokens: 0,
    creditsUsed: 0,
    creditsReserved: 0,
    creditBalance: 0,
    costUsd: 0,
    isFreeAccess: false,
    initialMonthlyCredits: 5000,
  });
  const [billingWarnings, setBillingWarnings] = useState<import('@shared/agentEvents').BillingWarningData[]>([]);
  
  // ISSUE 2 FIX: Track runId to detect new runs and prevent stale billing data
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // RunState reducer - unified progress tracking
  const [runState, dispatchRunState] = useReducer(runStateReducer, {
    runs: new Map(),
    currentRunId: null,
  });

  // Session ID scoped to project context
  const sessionId = useMemo(() => {
    const storageKey = targetContext === 'platform' 
      ? 'chat-session-platform'
      : `chat-session-${projectId || 'default'}`;
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = nanoid();
      localStorage.setItem(storageKey, id);
    }
    return id;
  }, [targetContext, projectId]);

  const [showCostPreview, setShowCostPreview] = useState(false);
  const [showComplexityError, setShowComplexityError] = useState(false);
  const [complexityErrorMessage, setComplexityErrorMessage] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string>("");
  const [costData, setCostData] = useState<{
    complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
    estimatedTokens: number;
    tokensRemaining: number;
    tokenLimit: number;
    overageTokens: number;
    overageCost: number;
    reasons: string[];
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Default greeting message
  const DEFAULT_GREETING: Message = {
    role: "assistant",
    content: targetContext === 'platform'
      ? "Hi! I'm LomuAI. I can help you diagnose and fix platform issues. What would you like me to help with?"
      : "Hi! I'm LomuAI, your self-healing development assistant. What would you like to build today?",
    timestamp: new Date(),
  };

  // Query user's credit wallet on component mount
  const { data: creditWallet } = useQuery<{ credits: number; initialMonthlyCredits: number }>({
    queryKey: ['/api/credits/wallet'],
    queryFn: async () => {
      const response = await fetch('/api/credits/wallet', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load credit wallet');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Load chat history (with optional sessionId)
  const effectiveProjectId = targetContext === 'platform' ? 'platform' : (projectId || 'general');
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/lomu-ai/history', effectiveProjectId, selectedSessionId],
    queryFn: async () => {
      const url = selectedSessionId 
        ? `/api/lomu-ai/history/${effectiveProjectId}?sessionId=${selectedSessionId}`
        : `/api/lomu-ai/history/${effectiveProjectId}`;
      
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load chat history');
      }
      return response.json();
    },
  });

  // Hydrate messages from API
  useEffect(() => {
    if (chatHistory?.messages && chatHistory.messages.length > 0) {
      setMessages(chatHistory.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })));
    } else if (!isLoadingHistory) {
      setMessages([DEFAULT_GREETING]);
    }
  }, [chatHistory, isLoadingHistory]);

  // Upload image mutation
  const uploadImageMutation = useMutation<{ imageUrl: string }, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/lomu-ai/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setPendingImages((prev) => [...prev, data.imageUrl]);
      toast({ description: "Image uploaded successfully!" });
    },
    onError: (error) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to upload image" 
      });
    },
  });

  // Fetch credit balance function
  const fetchCreditBalance = async () => {
    if (isFreeAccess) return;
    
    try {
      const response = await fetch('/api/credits/balance', {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error('[BILLING] Failed to fetch credit balance');
        return;
      }
      const data = await response.json();
      setCreditBalance(data.balance?.available || 0);
    } catch (error) {
      console.error('[BILLING] Failed to fetch credit balance:', error);
    }
  };

  // Fetch access tier from backend on mount
  useEffect(() => {
    async function fetchAccessTier() {
      try {
        const response = await fetch('/api/lomu-ai/access-tier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetContext, projectId }),
          credentials: 'include',
        });
        if (!response.ok) {
          console.error('[ACCESS] Failed to fetch access tier');
          setIsFreeAccess(false);
          return;
        }
        const data = await response.json();
        setIsFreeAccess(data.isFreeAccess);
        console.log(`[ACCESS] Access tier fetched: ${data.isFreeAccess ? 'FREE' : 'PAID'} (context: ${targetContext})`);
      } catch (error) {
        console.error('[ACCESS] Failed to fetch access tier:', error);
        setIsFreeAccess(false);
      }
    }
    
    fetchAccessTier();
  }, [targetContext, projectId]);

  // Fetch credit balance when not free access
  useEffect(() => {
    if (!isFreeAccess) {
      fetchCreditBalance();
    }
  }, [isFreeAccess]);

  // Update billing metrics when wallet data loads
  useEffect(() => {
    if (creditWallet) {
      setBillingMetrics(prev => ({
        ...prev,
        creditBalance: creditWallet.credits,
        initialMonthlyCredits: creditWallet.initialMonthlyCredits || 5000
      }));
    }
  }, [creditWallet]);

  // WebSocket streaming with room-based filtering
  const roomId = targetContext === 'platform'
    ? `platform_${user?.id || 'anonymous'}`
    : `project_${projectId || 'unknown'}`;
  const streamState = useWebSocketStream(sessionId, user?.id || 'anonymous', roomId);

  // State to track current message ID for task persistence
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  // Load tasks from API
  const { data: savedTasks } = useQuery<{ taskListId?: string; tasks: AgentTask[] }>({
    queryKey: ['/api/tasks', currentMessageId],
    queryFn: async () => {
      if (!currentMessageId) return { tasks: [] };
      const response = await fetch(`/api/tasks/${currentMessageId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        return { tasks: [] };
      }
      return response.json();
    },
    enabled: !!currentMessageId,
  });

  // Load tasks from localStorage or API
  useEffect(() => {
    if (currentMessageId) {
      const stored = localStorage.getItem(`tasks-${currentMessageId}`);
      if (stored) {
        try {
          const parsedTasks = JSON.parse(stored);
          setAgentTasks(parsedTasks);
          setShowTaskList(parsedTasks.length > 0);
        } catch (e) {
          console.error('Failed to parse stored tasks:', e);
        }
      } else if (savedTasks?.tasks && savedTasks.tasks.length > 0) {
        setAgentTasks(savedTasks.tasks);
        setShowTaskList(true);
      }
    }
  }, [currentMessageId, savedTasks]);

  // Sync WebSocket stream state to progress display
  useEffect(() => {
    if (streamState.currentThought) {
      setProgressStatus('thinking');
      setProgressMessage(streamState.currentThought);
      setCurrentPhase('thinking');
      setPhaseMessage(streamState.currentThought);
    } else if (streamState.currentAction) {
      setProgressStatus('working');
      setProgressMessage(streamState.currentAction);
      setCurrentPhase('working');
      setPhaseMessage(streamState.currentAction);
    } else if (streamState.chatProgress) {
      setProgressStatus('working');
      setProgressMessage(streamState.chatProgress.message || 'Working...');
      setCurrentPhase('working');
      setPhaseMessage(streamState.chatProgress.message || 'Working...');
    } else if (isGenerating) {
      setProgressStatus('working');
      setProgressMessage('Generating response...');
      setCurrentPhase('working');
      setPhaseMessage('Generating response...');
    } else {
      setProgressStatus('idle');
      setProgressMessage('');
      setCurrentPhase('complete');
      setPhaseMessage('');
    }
  }, [streamState.currentThought, streamState.currentAction, streamState.chatProgress, isGenerating]);

  // ✅ PHASE 3: Handle rate limit messages gracefully
  useEffect(() => {
    const checkForRateLimitMessage = (message: string | undefined) => {
      if (!message) return false;
      
      // Detect rate limit messages
      const isRateLimitMessage = 
        message.includes('Rate limit') ||
        message.includes('rate limit') ||
        message.includes('Waiting') && message.includes('before retry');
      
      if (isRateLimitMessage) {
        // Show user-friendly toast (not destructive - this is expected behavior)
        toast({
          title: "API Rate Limit",
          description: message,
          variant: "default",
        });
        return true;
      }
      return false;
    };

    // Check all message sources for rate limit indicators
    checkForRateLimitMessage(streamState.currentAction) ||
    checkForRateLimitMessage(streamState.currentThought) ||
    checkForRateLimitMessage(streamState.chatProgress?.message);
  }, [streamState.currentAction, streamState.currentThought, streamState.chatProgress, toast]);

  // Update agent UI from WebSocket events
  useEffect(() => {
    if (streamState.tasks && streamState.tasks.length > 0) {
      const convertedTasks: AgentTask[] = streamState.tasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
      }));
      setAgentTasks(convertedTasks);
      setShowTaskList(true);

      if (currentMessageId) {
        localStorage.setItem(`tasks-${currentMessageId}`, JSON.stringify(convertedTasks));
      }

      const activeTask = convertedTasks.find(t => t.status === 'in_progress');
      if (activeTask) {
        setActiveTaskId(activeTask.id);
      }

      const allCompleted = convertedTasks.every(t => t.status === 'completed');
      const hasInProgress = convertedTasks.some(t => t.status === 'in_progress');
      
      if (allCompleted && !hasInProgress) {
        const closeTimer = setTimeout(() => {
          setShowTaskList(false);
        }, 2000);
        return () => clearTimeout(closeTimer);
      }
    }
  }, [streamState.tasks, currentMessageId]);

  // Update metrics from WebSocket
  useEffect(() => {
    if (streamState.usage) {
      setCurrentMetrics({
        inputTokens: streamState.usage.inputTokens,
        outputTokens: streamState.usage.outputTokens,
        estimatedCost: ((streamState.usage.inputTokens * 0.003) + (streamState.usage.outputTokens * 0.015)) / 1000,
      });
    }
  }, [streamState.usage]);

  // Show deployment modal when deployment starts
  useEffect(() => {
    if (streamState.deployment && streamState.deployment.status === 'in_progress') {
      setShowDeploymentModal(true);
    }
  }, [streamState.deployment?.deploymentId]);

  // Auto-close deployment modal on success
  useEffect(() => {
    if (streamState.deployment?.status === 'successful') {
      const timer = setTimeout(() => {
        setShowDeploymentModal(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [streamState.deployment?.status]);

  // Clear status when AI completes and refresh credit balance
  useEffect(() => {
    if (streamState.currentStatus === 'completed') {
      setProgressStatus('idle');
      setProgressMessage("");
      setIsGenerating(false);
      
      // Refresh credit balance after completion
      if (!isFreeAccess) {
        fetchCreditBalance();
      }
    }
  }, [streamState.currentStatus, isFreeAccess]);

  // ISSUE 2 FIX: Reset billing metrics when new run starts (detected by phase change to 'thinking')
  useEffect(() => {
    if (currentPhase === 'thinking') {
      // Only reset if not already at zero (prevents unnecessary resets)
      setBillingMetrics(prev => {
        if (prev.creditsUsed > 0 || prev.creditsReserved > 0) {
          console.log('[BILLING RESET] New run detected via phase change, resetting metrics and warnings');
          // ISSUE 2 FIX: Also reset warnings on new run
          setBillingWarnings([]);
          return {
            inputTokens: 0,
            outputTokens: 0,
            creditsUsed: 0,
            creditsReserved: 0,
            creditBalance: prev.creditBalance, // Keep current balance
            costUsd: 0,
            isFreeAccess: prev.isFreeAccess, // Keep access tier
            initialMonthlyCredits: prev.initialMonthlyCredits || 5000, // Keep monthly allowance
          };
        }
        return prev;
      });
    }
  }, [currentPhase]);

  // Handle billing events from existing WebSocket stream
  // CRITICAL FIX: Track individual fields instead of object reference to ensure ALL updates are processed
  useEffect(() => {
    // Handle billing.estimate event
    if (streamState.billing?.estimate) {
      const estimateData = streamState.billing.estimate as import('@shared/agentEvents').BillingEstimateData;
      
      // ISSUE 1 FIX: Expect runId from backend, log warning if missing
      const newRunId = (estimateData as any).runId;
      if (!newRunId) {
        console.warn('[BILLING] Missing runId in billing.estimate event!', estimateData);
        return; // Don't process incomplete event
      }
      
      // ISSUE 1 FIX: Detect new run by checking runId change
      if (newRunId !== currentRunId) {
        console.log('[BILLING RESET] New run detected via runId change, resetting metrics and warnings');
        setCurrentRunId(newRunId);
        
        // Reset metrics for new run
        setBillingMetrics({
          inputTokens: 0,
          outputTokens: 0,
          creditsUsed: 0,
          creditsReserved: estimateData.estimatedCredits,
          creditBalance: estimateData.creditBalance,
          costUsd: estimateData.estimatedCostUsd,
          isFreeAccess: estimateData.isFreeAccess,
          initialMonthlyCredits: estimateData.initialMonthlyCredits || 5000,
        });
        
        // Reset warnings on new run
        setBillingWarnings([]);
      } else {
        // Same run, just update
        setBillingMetrics(prev => ({
          ...prev,
          creditsReserved: estimateData.estimatedCredits,
          creditBalance: estimateData.creditBalance,
          costUsd: estimateData.estimatedCostUsd,
          isFreeAccess: estimateData.isFreeAccess,
          initialMonthlyCredits: estimateData.initialMonthlyCredits || prev.initialMonthlyCredits || 5000,
        }));
      }
    }
    
    // Handle billing.update event
    if (streamState.billing?.update) {
      const updateData = streamState.billing.update as import('@shared/agentEvents').BillingUpdateData;
      setBillingMetrics(prev => ({
        ...prev,
        inputTokens: updateData.cumulativeInputTokens,
        outputTokens: updateData.cumulativeOutputTokens,
        creditsUsed: updateData.cumulativeCredits,
        creditBalance: updateData.creditBalance,
        costUsd: updateData.cumulativeCostUsd
      }));
    }
    
    // Handle billing.reconciled event
    if (streamState.billing?.reconciled) {
      const reconciledData = streamState.billing.reconciled as import('@shared/agentEvents').BillingReconciledData;
      
      // ISSUE 2 FIX: Preserve creditsReserved for post-run cost transparency
      setBillingMetrics(prev => ({
        ...prev,
        inputTokens: reconciledData.finalInputTokens,
        outputTokens: reconciledData.finalOutputTokens,
        creditsUsed: reconciledData.creditsActuallyUsed,
        creditsReserved: reconciledData.creditsReserved, // ✅ PRESERVE reserved credits
        creditBalance: reconciledData.newCreditBalance,
        costUsd: reconciledData.finalCostUsd
      }));
      
      console.log('[BILLING RECONCILED] Reserved:', reconciledData.creditsReserved, 
                  'Used:', reconciledData.creditsActuallyUsed, 
                  'Refunded:', reconciledData.creditsRefunded);
    }
    
    // Handle billing.warning events
    if (streamState.billing?.warnings && streamState.billing.warnings.length > billingWarnings.length) {
      const newWarnings = streamState.billing.warnings.slice(billingWarnings.length);
      setBillingWarnings(streamState.billing.warnings);
      
      newWarnings.forEach((warningData: import('@shared/agentEvents').BillingWarningData) => {
        // ISSUE 1 FIX: Add system message for warning with ALL required fields
        const systemMessage = {
          id: nanoid(),                      // REQUIRED field
          messageId: nanoid(),               // REQUIRED field
          role: "system" as const,
          content: `Warning: ${warningData.message}`,
          timestamp: new Date(),
          source: 'billing_warning'          // Optional but recommended
        };
        setMessages(prev => [...prev, systemMessage]);
        
        // Show modal for critical threshold
        if (warningData.threshold === 100) {
          setShowInsufficientCredits(true);
        }
        
        // Toast notification for other thresholds
        if (warningData.threshold === 80 || warningData.threshold === 90) {
          toast({
            variant: warningData.level === 'critical' ? 'destructive' : 'default',
            title: 'Credit Warning',
            description: warningData.message,
            duration: 7000,
          });
        }
      });
    }
  }, [
    // CRITICAL FIX: Track individual billing fields to detect ALL changes, not just object reference
    streamState.billing?.estimate?.estimatedCredits,
    streamState.billing?.estimate?.creditBalance,
    streamState.billing?.estimate?.estimatedCostUsd,
    streamState.billing?.estimate?.isFreeAccess,
    streamState.billing?.update?.cumulativeInputTokens,
    streamState.billing?.update?.cumulativeOutputTokens,
    streamState.billing?.update?.cumulativeCredits,
    streamState.billing?.update?.creditBalance,
    streamState.billing?.update?.cumulativeCostUsd,
    streamState.billing?.reconciled?.finalInputTokens,
    streamState.billing?.reconciled?.finalOutputTokens,
    streamState.billing?.reconciled?.creditsActuallyUsed,
    streamState.billing?.reconciled?.newCreditBalance,
    streamState.billing?.reconciled?.finalCostUsd,
    streamState.billing?.warnings?.length,
    toast,
    billingWarnings.length,
    currentRunId
  ]);

  // Complexity detection mutation (only for non-free access)
  const complexityMutation = useMutation<any, Error, { command: string }>({
    mutationFn: async (data) => {
      return await apiRequest("POST", "/api/analyze-complexity", data);
    },
    onSuccess: (data, variables) => {
      setCostData(data);
      setPendingCommand(variables.command);
      setShowCostPreview(true);
    },
    onError: (error: any, variables) => {
      setPendingCommand(variables.command);
      setComplexityErrorMessage(error.message || "Could not estimate tokens");
      setShowComplexityError(true);
    },
  });

  const commandMutation = useMutation<
    { commandId: string; result?: any; needsSecrets?: boolean; message?: string; requiredSecrets?: RequiredSecret[]; changes?: { created: string[]; modified: string[]; deleted: string[]; summary: string; } }, 
    Error, 
    { command: string; userId: string; projectId: string | null; secrets?: Record<string, string> }
  >({
    mutationFn: async (data) => {
      return await apiRequest("POST", "/api/commands", data);
    },
    onSuccess: (data, variables) => {
      if (data.needsSecrets) {
        setSecretsRequest({
          commandId: data.commandId,
          command: variables.command,
          message: data.message || "This project requires secure credentials",
          requiredSecrets: data.requiredSecrets || [],
        });

        const initialSecrets: Record<string, string> = {};
        data.requiredSecrets?.forEach((secret) => {
          initialSecrets[secret.key] = "";
        });
        setSecretsInput(initialSecrets);

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${data.message}\n\nI've detected that this project requires secure API keys or credentials. Please provide them below, and I'll continue building your project.`,
            timestamp: new Date(),
          },
        ]);

        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ description: "Project generated successfully!" });

      if (data.changes) {
        setLastChanges(data.changes);
        setTimeout(() => setLastChanges(null), 10000);
      }

      if (onProjectGenerated && data.result) {
        onProjectGenerated(data.result);
      }

      setIsGenerating(false);
      setProgressStatus('idle');
      setProgressMessage("");
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to generate project" 
      });

      setIsGenerating(false);
      setProgressStatus('idle');
      setProgressMessage("");
    },
  });

  const executeCommand = (command: string, secrets?: Record<string, string>) => {
    setLastCommand(command);
    setIsGenerating(true);
    setProgressStatus('thinking');
    // Phase-driven progress - RunState will provide specific messaging
    setProgressMessage("");

    const startTime = Date.now();

    // Clear old progress steps - RunState will track tasks
    const progressSteps: ProgressStep[] = [];

    setCurrentProgress(progressSteps);

    const progressInterval = setInterval(() => {
      setCurrentProgress((prev) => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const timeElapsed = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

        const currentStep = Math.min(Math.floor(elapsed / 10000), progressSteps.length - 1);
        
        return prev.map((step, index) => {
          if (index < currentStep) {
            return { ...step, progress: 100 };
          } else if (index === currentStep) {
            const stepProgress = ((elapsed % 10000) / 10000) * 100;
            return { ...step, progress: Math.min(stepProgress, 95) };
          }
          return step;
        });
      });
    }, 100);

    commandMutation.mutate(
      {
        command,
        userId: user?.id?.toString() || 'anonymous',
        projectId: targetContext === 'platform' ? null : (projectId || null),
        secrets: secrets || {},
      },
      {
        onSettled: () => {
          clearInterval(progressInterval);
          setCurrentProgress([]);
        },
      }
    );
  };

  const handleSend = async () => {
    if (!input.trim() && pendingImages.length === 0) return;

    // CRITICAL: Refresh credit balance before EVERY message (not just on mount)
    if (!isFreeAccess) {
      try {
        const response = await fetch('/api/credits/balance', {
          credentials: 'include',
        });
        if (!response.ok) {
          console.error('[BILLING] Failed to fetch credit balance');
          toast({
            title: 'Error',
            description: 'Unable to verify credit balance. Please try again.',
            variant: 'destructive'
          });
          return; // BLOCK on error
        }
        const data = await response.json();
        const currentBalance = data.balance?.available || 0;
        setCreditBalance(currentBalance);
        
        // Estimate cost (rough: 1 char = 0.001 credits)
        const estimatedCost = input.length * 0.001;
        
        if (currentBalance < estimatedCost) {
          setShowInsufficientCredits(true);
          toast({
            title: 'Insufficient Credits',
            description: `You need at least ${estimatedCost.toFixed(0)} credits. Current balance: ${currentBalance}`,
            variant: 'destructive'
          });
          return; // BLOCK message send
        }
      } catch (error) {
        console.error('[BILLING] Failed to check credit balance:', error);
        toast({
          title: 'Error',
          description: 'Unable to verify credit balance. Please try again.',
          variant: 'destructive'
        });
        return; // BLOCK on error
      }
    }

    const newMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };

    setMessages((prev) => [...prev, newMessage]);
    
    const messageId = nanoid();
    setCurrentMessageId(messageId);
    localStorage.setItem(`current-message-id`, messageId);

    // Clear input immediately for better UX
    const userMessage = input;
    const userImages = [...pendingImages];
    setInput("");
    setPendingImages([]);

    // Start SSE streaming
    setIsGenerating(true);
    setProgressStatus('thinking');
    setProgressMessage('Connecting to LomuAI...');

    try {
      const response = await fetch('/api/lomu-ai/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          attachments: userImages.length > 0 ? userImages.map(url => ({ url })) : [],
          sessionId,
          targetContext,
          projectId: targetContext === 'platform' ? null : (projectId || null),
          autoCommit: true,
          autoPush: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessageContent = '';
      let assistantMessageId = '';
      
      // Capture progress messages during streaming
      const capturedProgress: Array<{ id: string; message: string; timestamp: number }> = [];

      // Create temporary assistant message for streaming
      const tempAssistantMessage: Message = {
        id: nanoid(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        progressMessages: [],
      };
      setMessages((prev) => [...prev, tempAssistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[SSE] Stream complete');
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (end with \n\n)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete message in buffer

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) {
            // Skip empty lines and comments (heartbeat)
            continue;
          }

          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6));
              console.log('[SSE] Event:', eventData.type, eventData);

              switch (eventData.type) {
                case 'user_message':
                  assistantMessageId = eventData.messageId;
                  setProgressMessage('Processing your request...');
                  break;

                case 'content':
                  assistantMessageContent += eventData.content || '';
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      lastMsg.content = assistantMessageContent;
                      // Force React to recognize this as a state change
                      return [...updated];
                    }
                    return updated;
                  });
                  setProgressStatus('working');
                  setProgressMessage('Generating response...');
                  break;

                case 'thinking':
                  setProgressStatus('thinking');
                  setProgressMessage(eventData.message || 'Thinking...');
                  break;

                case 'tool_call':
                  setProgressStatus('working');
                  setProgressMessage(`Using tool: ${eventData.tool || 'unknown'}...`);
                  break;

                case 'run_phase':
                  setCurrentPhase(eventData.phase || 'working');
                  setPhaseMessage(eventData.message || '');
                  break;

                case 'assistant_progress':
                  // Handle inline thinking/action/result progress messages
                  const progressEntry = {
                    id: eventData.progressId || nanoid(),
                    message: eventData.content || '',
                    timestamp: Date.now(),
                    category: eventData.category || 'action'
                  };
                  
                  // Append to current assistant message's progressMessages
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      if (!lastMsg.progressMessages) {
                        lastMsg.progressMessages = [];
                      }
                      lastMsg.progressMessages.push(progressEntry);
                      return [...updated]; // Force re-render
                    }
                    return updated;
                  });
                  
                  // Also update progress status for status bar
                  if (eventData.category === 'thinking') {
                    setProgressStatus('thinking');
                    setProgressMessage(eventData.content || 'Thinking...');
                  } else if (eventData.category === 'action') {
                    setProgressStatus('working');
                    setProgressMessage(eventData.content || 'Working...');
                  }
                  break;

                // RunState event handlers
                case 'run.started':
                  console.log('[RunState] Run started:', eventData);
                  dispatchRunState({ type: 'run.started', data: eventData as RunStartedData });
                  setProgressStatus('thinking');
                  break;

                case 'run.state_updated':
                  console.log('[RunState] State updated:', eventData);
                  dispatchRunState({ type: 'run.state_updated', data: eventData as RunStateUpdateData });
                  if (eventData.phase) {
                    setCurrentPhase(eventData.phase);
                    // Map phase to progressStatus
                    if (eventData.phase === 'thinking') setProgressStatus('thinking');
                    else if (eventData.phase === 'working') setProgressStatus('working');
                    else if (eventData.phase === 'verifying') setProgressStatus('vibing');
                  }
                  break;

                case 'task.created':
                  console.log('[RunState] Task created:', eventData);
                  dispatchRunState({ type: 'task.created', data: eventData as TaskCreatedData });
                  break;

                case 'task.updated':
                  console.log('[RunState] Task updated:', eventData);
                  dispatchRunState({ type: 'task.updated', data: eventData as TaskUpdatedData });
                  break;

                case 'run.completed':
                  console.log('[RunState] Run completed:', eventData);
                  dispatchRunState({ type: 'run.completed', data: eventData as RunCompletedData });
                  setProgressStatus('idle');
                  break;

                case 'run.failed':
                  console.error('[RunState] Run failed:', eventData);
                  dispatchRunState({ type: 'run.failed', data: eventData as RunFailedData });
                  setProgressStatus('idle');
                  toast({
                    variant: 'destructive',
                    title: 'Run Failed',
                    description: eventData.errorMessage || 'The agent run encountered an error',
                  });
                  break;

                case 'complete':
                case 'done':
                  console.log('[SSE] Stream complete event');
                  setIsGenerating(false);
                  setProgressStatus('idle');
                  setProgressMessage('');
                  
                  // Refresh chat history to get server-saved messages
                  queryClient.invalidateQueries({ queryKey: ['/api/lomu-ai/history', effectiveProjectId] });
                  break;

                case 'progress':
                  // Handle progress updates (shown in status bar, not inline chat)
                  console.log('[SSE] Progress:', eventData.message);
                  if (eventData.message) {
                    setProgressMessage(eventData.message);
                    
                    // If it's a warning/failure message, show toast
                    if (eventData.message.includes('🚨') || eventData.message.includes('failure') || eventData.message.includes('Safety limit')) {
                      toast({
                        variant: eventData.message.includes('🚨') ? 'destructive' : 'default',
                        title: 'LomuAI Status',
                        description: eventData.message,
                      });
                    }
                  }
                  break;

                case 'error':
                  console.error('[SSE] Error event:', eventData);
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: eventData.message || 'An error occurred while processing your request',
                  });
                  setIsGenerating(false);
                  setProgressStatus('idle');
                  setProgressMessage('');
                  break;

                default:
                  // Handle other event types (task_list_created, task_updated, file_change, etc.)
                  console.log('[SSE] Unhandled event type:', eventData.type);
              }
            } catch (parseError) {
              console.error('[SSE] Failed to parse event:', parseError, line);
            }
          }
        }
      }

      // Final cleanup - attach captured progress to the last assistant message
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          lastMsg.progressMessages = capturedProgress;
        }
        return updated;
      });
      
      setIsGenerating(false);
      setProgressStatus('idle');
      setProgressMessage('');

    } catch (error: any) {
      console.error('[SSE] Stream error:', error);
      
      setIsGenerating(false);
      setProgressStatus('idle');
      setProgressMessage('');

      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: error.message || 'Failed to connect to LomuAI. Please try again.',
      });

      // Remove the temporary assistant message on error
      setMessages((prev) => prev.filter(msg => msg.content !== ''));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    setIsGenerating(false);
    setProgressStatus('idle');
    setProgressMessage("");
    setCurrentProgress([]);
    toast({ title: "Generation stopped", description: "The AI has been stopped." });
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();

        const file = item.getAsFile();
        if (!file) continue;

        if (!ALLOWED_FORMATS.includes(file.type)) {
          toast({
            variant: "destructive",
            description: `Unsupported image format. Please use: JPG, PNG, GIF, or WebP`
          });
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          toast({
            variant: "destructive",
            description: `Image too large (${sizeMB}MB). Maximum size is 5MB`
          });
          continue;
        }

        const tempId = nanoid();
        setUploadingImages(prev => new Map(prev).set(tempId, true));

        uploadImageMutation.mutate(file, {
          onSuccess: () => {
            setUploadingImages(prev => {
              const next = new Map(prev);
              next.delete(tempId);
              return next;
            });
          },
          onError: () => {
            setUploadingImages(prev => {
              const next = new Map(prev);
              next.delete(tempId);
              return next;
            });
          },
        });
      }
    }
  };

  const handleImageSelect = async (files: FileList) => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!ALLOWED_FORMATS.includes(file.type)) {
        toast({
          variant: "destructive",
          description: `Unsupported image format. Please use: JPG, PNG, GIF, or WebP`
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        toast({
          variant: "destructive",
          description: `Image too large (${sizeMB}MB). Maximum size is 5MB`
        });
        continue;
      }

      const tempId = nanoid();
      setUploadingImages(prev => new Map(prev).set(tempId, true));

      uploadImageMutation.mutate(file, {
        onSuccess: () => {
          setUploadingImages(prev => {
            const next = new Map(prev);
            next.delete(tempId);
            return next;
          });
        },
        onError: () => {
          setUploadingImages(prev => {
            const next = new Map(prev);
            next.delete(tempId);
            return next;
          });
        },
      });
    }
  };

  const removeImage = (imageUrl: string) => {
    setPendingImages((prev) => prev.filter((url) => url !== imageUrl));
  };

  const handleSecretsSubmit = () => {
    if (!secretsRequest) return;

    const allSecretsFilled = secretsRequest.requiredSecrets.every(
      (secret) => secretsInput[secret.key]?.trim()
    );

    if (!allSecretsFilled) {
      toast({
        variant: "destructive",
        description: "Please fill in all required credentials",
      });
      return;
    }

    executeCommand(secretsRequest.command, secretsInput);
    setSecretsRequest(null);
    setSecretsInput({});
  };

  const handleCostPreviewProceed = () => {
    if (!pendingCommand) return;
    setShowCostPreview(false);
    executeCommand(pendingCommand);
    setPendingCommand("");
    setCostData(null);
  };

  const handleClearScratchpad = async () => {
    try {
      await apiRequest("DELETE", `/api/scratchpad/${sessionId}`);
      toast({ title: "Scratchpad cleared" });
    } catch (error) {
      toast({ 
        variant: "destructive",
        description: "Failed to clear scratchpad" 
      });
    }
  };

  // Auto-scroll to bottom when messages or streaming content changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamState.fullMessage, streamState.progressMessages, isGenerating]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Global overlays - outside panels */}
      {lastChanges && (
        <ChangesPanel
          changes={lastChanges}
          onClose={() => setLastChanges(null)}
        />
      )}

      {/* ChatHeader */}
      <ChatHeader
        targetContext={targetContext}
        creditBalance={creditBalance}
        isFreeAccess={isFreeAccess}
        isConnected={streamState.isConnected}
        onHistoryClick={() => setShowHistoryDialog(true)}
        onSettingsClick={() => {
          toast({ title: "Settings", description: "Settings feature coming soon" });
        }}
      />

      {/* ResizablePanel Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Left Panel: Messages (70%) */}
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Agent Status Strip - Shows current phase */}
            {isGenerating && (
              <StatusStrip 
                phase={currentPhase}
                message={phaseMessage}
                currentThought={streamState.currentThought}
                isExecuting={isGenerating}
                billingMetrics={billingMetrics}
              />
            )}

            {/* RunState Progress Table - Replit-style Kanban */}
            {runState.currentRunId && runState.runs.get(runState.currentRunId) && (
              <div className="px-6 pt-4 pb-2 bg-[hsl(220,18%,16%)] border-b border-[hsl(220,15%,28%)]">
                <RunProgressTable runState={runState.runs.get(runState.currentRunId)!} />
              </div>
            )}

            {/* AI Progress - Only show when no task list exists and no RunState */}
            {(currentProgress.length > 0 || isGenerating) && agentTasks.length === 0 && !runState.currentRunId && (
              <div className="px-6 pt-4 pb-2 bg-[hsl(220,18%,16%)] border-b border-[hsl(220,15%,28%)]">
                <AgentProgress
                  steps={currentProgress}
                  metrics={currentMetrics}
                />
              </div>
            )}

            {/* Copy Chat History Button */}
            {messages.length > 1 && (
              <div className="px-4 py-2 border-b border-border bg-muted/20 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const chatHistory = messages.filter(m => !m.isSummary).map(m => 
                      `${m.role === 'user' ? 'USER' : 'LOMU AI'}:\n${m.content}\n`
                    ).join('\n---\n\n');
                    navigator.clipboard.writeText(chatHistory);
                    setCopiedChatHistory(true);
                    setTimeout(() => setCopiedChatHistory(false), 2000);
                    toast({ title: "✅ Chat copied!" });
                  }}
                  className="h-7 gap-1.5"
                  data-testid="button-copy-chat"
                >
                  {copiedChatHistory ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span className="text-xs">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span className="text-xs">Copy Chat</span>
                    </>
                  )}
                </Button>
              </div>
            )}

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scroll-smooth"
          data-testid="messages-container"
        >
          {/* Progress Messages */}
          {streamState.progressMessages.length > 0 && (
            <div className="flex flex-col gap-2">
              {streamState.progressMessages.map((progress) => (
                <div key={progress.id} className="flex gap-3 justify-start">
                  <div className="max-w-[75%] rounded-2xl px-3 py-2 bg-secondary/30 border border-border/30">
                    <p className="text-xs text-muted-foreground leading-relaxed">{progress.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {messages
            .filter((msg, idx) => {
              // Filter out the last assistant message if we're currently streaming
              // (it will be shown in the streaming indicator below)
              if (isGenerating && idx === messages.length - 1 && msg.role === 'assistant') {
                return false;
              }
              return true;
            })
            .map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3 items-start",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-lg px-4 py-3 border",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground shadow-md border-primary/20"
                    : message.isSummary 
                      ? "bg-muted/30 border-border/50" 
                      : "bg-card text-card-foreground border-border/30 shadow-sm"
                )}>
                  {message.isSummary ? (
                    <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Earlier messages summarized for efficiency</span>
                    </div>
                  ) : (
                    <EnhancedMessageDisplay 
                      content={cleanAIResponse(parseMessageContent(message.content))}
                      progressMessages={[]}
                      isStreaming={false}
                    />
                  )}

                  {message.checkpoint && !isFreeAccess && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Complexity:</span>
                          <span className="font-semibold">{message.checkpoint.complexity}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Estimated Cost:</span>
                          <span className="font-semibold">${message.checkpoint.cost.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Time:</span>
                          <span className="font-semibold">{message.checkpoint.estimatedTime}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {message.images && message.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.images.map((imageUrl, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={imageUrl}
                          alt={`Attached ${imgIndex + 1}`}
                          className="max-w-[200px] rounded border border-white/20 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setZoomImage(imageUrl)}
                          data-testid={`message-image-${index}-${imgIndex}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

              {message.role === "user" && (
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming Indicator - Use WebSocket OR check if last message has content */}
          {isGenerating && (
            (() => {
              // Check if we have streaming content from either WebSocket or SSE
              const lastMessage = messages[messages.length - 1];
              const hasContent = streamState.fullMessage || (lastMessage?.role === 'assistant' && lastMessage.content);
              
              if (hasContent) {
                // Show actual streaming content
                const content = streamState.fullMessage || lastMessage?.content || '';
                const progressMsgs = streamState.progressMessages.length > 0 
                  ? streamState.progressMessages 
                  : (lastMessage?.progressMessages || []);
                
                return (
                  <div className="flex gap-3 items-start">
                    <div className="max-w-[75%] rounded-lg px-4 py-3 bg-card text-card-foreground shadow-sm border border-border/30">
                      <EnhancedMessageDisplay 
                        content={cleanAIResponse(parseMessageContent(content))}
                        progressMessages={progressMsgs}
                        isStreaming={true}
                      />
                    </div>
                  </div>
                );
              } else {
                // Show thinking indicator
                return (
                  <div className="flex gap-3 items-start">
                    <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-muted border border-border">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Thinking...</span>
                      </div>
                    </div>
                  </div>
                );
              }
            })()
          )}

          {/* Scroll anchor - keeps chat scrolled to bottom */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)] p-4">
          {/* WebSocket Stream: File Status */}
          {streamState.currentFile && (
            <div className="mb-2 px-3 py-1.5 bg-[hsl(220,16%,20%)] border-l-2 border-emerald-500/60 rounded text-xs" data-testid="stream-file-status">
              <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
                <span className="font-mono text-[hsl(220,70%,60%)]">{streamState.currentFile.action}</span>
                <span className="font-mono">{streamState.currentFile.filename}</span>
                <span className="ml-auto text-[hsl(220,12%,55%)]">{streamState.currentFile.language}</span>
                <Loader2 className="w-3 h-3 animate-spin text-[hsl(220,70%,60%)]" />
              </p>
            </div>
          )}

          {/* WebSocket Stream: File Summary */}
          {streamState.fileSummary && !streamState.currentFile && (
            <div className="mb-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs" data-testid="stream-file-summary">
              <div className="flex items-center justify-between text-emerald-200">
                <span className="font-semibold">
                  ✓ Modified {streamState.fileSummary.filesChanged} file{streamState.fileSummary.filesChanged !== 1 ? 's' : ''}
                </span>
                <span className="text-emerald-300/70">
                  +{streamState.fileSummary.linesAdded} lines
                  {streamState.fileSummary.linesRemoved !== undefined && ` / -${streamState.fileSummary.linesRemoved}`}
                </span>
              </div>
            </div>
          )}

          {/* Image Preview Section */}
          {(pendingImages.length > 0 || uploadingImages.size > 0) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {Array.from(uploadingImages.keys()).map((tempId) => (
                <div key={tempId} className="relative">
                  <div className="h-20 w-20 rounded border border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[hsl(220,70%,60%)]" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-[hsl(220,12%,55%)] bg-[hsl(220,20%,12%)]/80 px-2 py-1 rounded">
                      Uploading...
                    </span>
                  </div>
                </div>
              ))}

              {pendingImages.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Preview ${index + 1}`}
                    className="h-20 w-20 object-cover rounded border border-[hsl(220,15%,28%)]"
                    data-testid={`image-preview-${index}`}
                  />
                  <button
                    onClick={() => removeImage(imageUrl)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-image-${index}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Message LomuAI..."
                className="min-h-[60px] max-h-[200px] resize-none text-base bg-background border-border focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl px-4 py-3 pr-12 transition-all"
                disabled={isGenerating}
                data-testid="input-chat-message"
                rows={3}
              />
              <div className="absolute bottom-2 right-2">
                <ChatInputToolbar
                  onImageSelect={handleImageSelect}
                  disabled={isGenerating}
                />
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              size="icon"
              variant="default"
              className="flex-shrink-0 h-12 w-12 rounded-full shadow-md hover:shadow-lg transition-all"
              data-testid="button-send-chat"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="hidden md:flex" />

        {/* Right Panel: Context Rail (30%) - Hidden on mobile */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="hidden md:block">
          <ContextRail
            tasks={agentTasks}
            artifacts={artifacts}
            runState={runState.currentRunId ? runState.runs.get(runState.currentRunId) || null : null}
            onTaskClick={setActiveTaskId}
            onArtifactView={(artifact) => {
              // Handle artifact view - could open in a modal or drawer
              setShowArtifactsDrawer(true);
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Mobile: Drawer for Context Rail */}
      <Drawer open={contextDrawerOpen} onOpenChange={setContextDrawerOpen}>
        <DrawerContent className="h-[80vh] md:hidden">
          <div className="overflow-y-auto h-full">
            <ContextRail
              tasks={agentTasks}
              artifacts={artifacts}
              runState={runState.currentRunId ? runState.runs.get(runState.currentRunId) || null : null}
              onTaskClick={(taskId) => {
                setActiveTaskId(taskId);
                setContextDrawerOpen(false);
              }}
              onArtifactView={(artifact) => {
                setShowArtifactsDrawer(true);
                setContextDrawerOpen(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Mobile: FAB to open context drawer */}
      <button
        onClick={() => setContextDrawerOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
        data-testid="button-open-context-drawer"
        aria-label="Open context menu"
        title="Open context menu"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Message History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl h-[80vh] p-0">
          <MessageHistory
            currentSessionId={selectedSessionId}
            onSessionSelect={(session) => {
              // Close dialog immediately for better UX
              setShowHistoryDialog(false);
              
              // Hybrid navigation: different project = full reload, same project = state update
              const newProjectId = session.projectId || 'general';
              
              if (newProjectId !== projectId) {
                // Different project: Full page navigation
                // Use setTimeout to ensure dialog closes before navigation
                setTimeout(() => {
                  window.location.href = `/chat/${newProjectId}`;
                }, 100);
              } else {
                // Same project: Update selectedSessionId to trigger instant message reload
                console.log(`📝 [MESSAGE-HISTORY] Loading session ${session.id} for current project`);
                setSelectedSessionId(session.id);
              }
            }}
            onClose={() => setShowHistoryDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Secrets Request Dialog */}
      <Dialog open={!!secretsRequest} onOpenChange={() => setSecretsRequest(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Secure Credentials Required
            </DialogTitle>
            <DialogDescription>
              {secretsRequest?.message}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {secretsRequest?.requiredSecrets.map((secret) => (
              <div key={secret.key} className="space-y-2">
                <Label htmlFor={secret.key}>{secret.key}</Label>
                <Input
                  id={secret.key}
                  type="password"
                  placeholder={secret.description}
                  value={secretsInput[secret.key] || ""}
                  onChange={(e) =>
                    setSecretsInput((prev) => ({
                      ...prev,
                      [secret.key]: e.target.value,
                    }))
                  }
                  data-testid={`input-secret-${secret.key}`}
                />
                {secret.getInstructions && (
                  <p className="text-xs text-muted-foreground">
                    {secret.getInstructions}
                  </p>
                )}
              </div>
            ))}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your credentials are encrypted and never stored. They're used only for this project generation.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSecretsRequest(null)}
              data-testid="button-cancel-secrets"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSecretsSubmit}
              disabled={commandMutation.isPending}
              data-testid="button-submit-secrets"
            >
              {commandMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Continue Generation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Cost Preview Dialog - Only show when NOT free access */}
      {!isFreeAccess && (
        <Dialog open={showCostPreview} onOpenChange={setShowCostPreview}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            {costData && (
              <CostPreview
                complexity={costData?.complexity}
                estimatedTokens={costData?.estimatedTokens}
                tokensRemaining={costData?.tokensRemaining}
                tokenLimit={costData?.tokenLimit}
                overageTokens={costData?.overageTokens}
                overageCost={costData?.overageCost}
                reasons={costData?.reasons}
                onConfirm={handleCostPreviewProceed}
                onCancel={() => {
                  setShowCostPreview(false);
                  setPendingCommand("");
                  setCostData(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Complexity Error Dialog */}
      <Dialog open={showComplexityError} onOpenChange={setShowComplexityError}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Token Estimation Failed</DialogTitle>
            <DialogDescription>
              {complexityErrorMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplexityError(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              setShowComplexityError(false);
              if (pendingCommand) {
                executeCommand(pendingCommand);
                setPendingCommand("");
              }
            }}>
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deployment Modal */}
      {streamState.deployment && (
        <DeploymentStatusModal
          open={showDeploymentModal}
          onOpenChange={setShowDeploymentModal}
          deploymentId={streamState.deployment.deploymentId}
          commitHash={streamState.deployment.commitHash}
          commitMessage={streamState.deployment.commitMessage}
          commitUrl={streamState.deployment.commitUrl}
          timestamp={streamState.deployment.timestamp}
          platform={streamState.deployment.platform}
          steps={streamState.deployment.steps}
          status={streamState.deployment.status}
          deploymentUrl={streamState.deployment.deploymentUrl}
          errorMessage={streamState.deployment.errorMessage}
        />
      )}

      {/* Insufficient Credits Dialog */}
      <AlertDialog open={showInsufficientCredits} onOpenChange={setShowInsufficientCredits}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Insufficient Credits</AlertDialogTitle>
            <AlertDialogDescription>
              You don't have enough credits to complete this request. 
              Please purchase more credits to continue using LomuAI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-insufficient-credits-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => window.location.href = '/pricing'}
              data-testid="button-insufficient-credits-purchase"
            >
              Purchase Credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
            <img
              src={zoomImage}
              alt="Zoomed"
              className="w-full h-full object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
