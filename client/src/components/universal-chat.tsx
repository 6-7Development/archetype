import { useState, useRef, useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
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
import { TestingPanel } from "@/components/testing-panel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ContextRail } from "@/components/chat/ContextRail";
import { MessageHistory } from "@/components/chat/MessageHistory";
import { useStreamEvents } from "./chat/useStreamEvents";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInput } from "./chat/ChatInput";
import { StatusBar } from "./chat/StatusBar";
import { ChatDialogs } from "./chat/ChatDialogs";
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
  // ✅ GAP FIX #3: Add validation metadata field for tool results
  validationMetadata?: {
    valid?: boolean;
    truncated?: boolean;
    warnings?: string[];
    schemaValidated?: boolean;
  };
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
  targetContext: 'platform' | 'project' | 'architect';
  projectId?: string | null;
  onProjectGenerated?: (result: any) => void;
}

// ============================================================================
// Component now uses extracted useStreamEvents hook for run state management
// ============================================================================

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

  // Testing panel state
  const [testingSession, setTestingSession] = useState<{
    sessionId: string;
    url: string;
    status: 'initializing' | 'running' | 'completed' | 'failed';
    narration: string[];
    steps: Array<{
      id: string;
      type: 'navigate' | 'action' | 'assertion' | 'screenshot';
      description: string;
      status: 'pending' | 'running' | 'passed' | 'failed';
      timestamp: number;
      screenshot?: string;
      error?: string;
    }>;
    startedAt: number;
    completedAt?: number;
  } | null>(null);

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

  // RunState reducer - unified progress tracking (extracted to useStreamEvents hook)
  const { runState, dispatchRunState } = useStreamEvents();

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
    content: targetContext === 'architect'
      ? "Hi! I'm the I AM Architect. I can help you design and architect your application with advanced reasoning. What would you like to build?"
      : targetContext === 'platform'
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
  
  // 🔥 Route to correct history endpoint based on targetContext
  const historyEndpointBase = targetContext === 'architect' 
    ? '/api/architect/history' 
    : '/api/lomu-ai/history';
  
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery<{ messages: Message[] }>({
    queryKey: [historyEndpointBase, effectiveProjectId, selectedSessionId],
    queryFn: async () => {
      const url = selectedSessionId 
        ? `${historyEndpointBase}/${effectiveProjectId}?sessionId=${selectedSessionId}`
        : `${historyEndpointBase}/${effectiveProjectId}`;
      
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
      
      // 🔥 Route to correct upload endpoint based on targetContext
      const uploadEndpoint = targetContext === 'architect' 
        ? '/api/architect/upload-image' 
        : '/api/lomu-ai/upload-image';
      
      const response = await fetch(uploadEndpoint, {
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
    // 🔧 Architect context is ALWAYS FREE (no need to check backend)
    if (targetContext === 'architect') {
      setIsFreeAccess(true);
      console.log('[ACCESS] Architect context - FREE access granted');
      return;
    }
    
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
    // 🔧 SKIP credit check for architect context (always FREE for platform healing)
    if (!isFreeAccess && targetContext !== 'architect') {
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
      // 🔥 Route to correct endpoint based on targetContext
      const endpoint = targetContext === 'architect' 
        ? '/api/architect/stream' 
        : '/api/lomu-ai/stream';
      
      console.log('[SSE-FETCH] ⚡ Starting fetch request to', endpoint);
      console.log('[SSE-FETCH] 📦 Request body:', { message: userMessage.substring(0, 50), sessionId, targetContext });
      
      // 🔥 USE ABSOLUTE URL to bypass Vite's middleware buffering
      const baseUrl = window.location.origin;
      const sseUrl = `${baseUrl}${endpoint}`;
      
      console.log('[SSE-FETCH] 🌐 Using absolute URL to bypass Vite:', sseUrl);
      
      const response = await fetch(sseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Accept': 'text/event-stream',
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
      
      console.log('[SSE-FETCH] ✅ Response received!', response.status, response.statusText);

      console.log('[SSE-FETCH] Response received:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: {
          contentType: response.headers.get('content-type'),
          cacheControl: response.headers.get('cache-control'),
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[SSE-FETCH] Response not OK:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        console.error('[SSE-FETCH] No response body!');
        throw new Error('No response body received');
      }

      console.log('[SSE-FETCH] ✅ Response body exists, starting stream parsing...');

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

      console.log('[SSE-DEBUG] ⚡ Entering while loop, about to start reading stream...');
      let chunkCount = 0;
      
      while (true) {
        console.log('[SSE-DEBUG] 🔄 About to call reader.read(), chunk#:', chunkCount);
        
        const { done, value } = await reader.read();
        chunkCount++;
        
        console.log('[SSE-DEBUG] ✅ reader.read() returned, done:', done, 'value length:', value?.length || 0);
        
        if (done) {
          console.log('[SSE] Stream complete');
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        console.log('[SSE-DEBUG] 📦 Buffer chunk received, total buffer length:', buffer.length);

        // Process complete SSE messages (end with \n\n or \r\n\r\n)
        // Split on both Unix (\n\n) and Windows (\r\n\r\n) line endings
        const lines = buffer.split(/\r?\n\r?\n/);
        buffer = lines.pop() || ''; // Keep incomplete message in buffer
        console.log('[SSE-DEBUG] Extracted', lines.length, 'lines from buffer');

        for (const line of lines) {
          const trimmedLine = line.trim(); // Remove carriage returns and whitespace
          
          if (!trimmedLine || trimmedLine.startsWith(':')) {
            // Skip empty lines and comments (heartbeat)
            console.log('[SSE-DEBUG] Skipping comment or empty line');
            continue;
          }

          // ✅ NEW SSE PARSER: Handle BOTH proper SSE format AND old envelope format
          // Parse event name and data
          let eventName = 'message'; // default event type
          let dataStr = '';
          
          const eventLines = trimmedLine.split('\n');
          for (const eventLine of eventLines) {
            if (eventLine.startsWith('event: ')) {
              eventName = eventLine.substring(7).trim();
            } else if (eventLine.startsWith('data: ')) {
              dataStr = eventLine.substring(6).trim();
            }
          }

          if (dataStr) {
            try {
              console.log('[SSE-DEBUG] Parsing event:', eventName, 'data:', dataStr.substring(0, 100));
              const eventData = JSON.parse(dataStr);
              console.log('[SSE] Event:', eventName, eventData);

              // ✅ HYBRID SUPPORT: Handle both old envelope format AND new proper SSE format
              let payload = eventData;
              
              // If backend sent old format {type: "X", data: {...}}, extract the type and data
              if (eventData.type && typeof eventData.data === 'object') {
                console.log('[SSE] Old envelope format detected, extracting type:', eventData.type);
                eventName = eventData.type; // Use type from envelope as event name
                payload = eventData.data || eventData; // Use data field as payload
              }
              
              switch (eventName) {
                case 'heartbeat':
                  // Heartbeat event, just log
                  console.log('[SSE] Heartbeat received');
                  break;

                case 'user_message':
                  assistantMessageId = payload.messageId;
                  setProgressMessage('Processing your request...');
                  break;

                case 'content':
                  assistantMessageContent += payload.content || '';
                  console.log('[SSE-CONTENT] Accumulated:', assistantMessageContent.length, 'chars');
                  
                  // 🔥 USE flushSync() to force immediate render - prevents React batching
                  // This makes text appear word-by-word like ChatGPT instead of in chunks
                  flushSync(() => {
                    setMessages((prev) => {
                      const updated = [...prev];
                      const lastMsgIndex = updated.length - 1;
                      const lastMsg = updated[lastMsgIndex];
                      if (lastMsg && lastMsg.role === 'assistant') {
                        // ✅ CREATE NEW MESSAGE OBJECT - React detects change!
                        const updatedMsg = {
                          ...lastMsg,
                          content: assistantMessageContent,
                          id: lastMsg.id || nanoid(), // Ensure ID exists
                          messageId: lastMsg.messageId || lastMsg.id || nanoid() // Ensure messageId exists
                        };
                        updated[lastMsgIndex] = updatedMsg;
                        console.log('[SSE-UPDATE] Updated message:', updatedMsg.id, 'content length:', updatedMsg.content.length);
                        return updated;
                      }
                      console.warn('[SSE-UPDATE] No assistant message found to update!');
                      return prev;  // Return original if no assistant message found
                    });
                  });
                  
                  setProgressStatus('working');
                  setProgressMessage('Generating response...');
                  break;

                case 'thinking':
                  setProgressStatus('thinking');
                  setProgressMessage(payload.message || 'Thinking...');
                  break;

                case 'tool_call':
                  setProgressStatus('working');
                  setProgressMessage(`Using tool: ${payload.tool || 'unknown'}...`);
                  break;

                case 'tool_result':
                  // Tool execution completed
                  console.log('[SSE] Tool result received:', payload.tool);
                  break;

                case 'run_phase':
                  setCurrentPhase(payload.phase || 'working');
                  setPhaseMessage(payload.message || '');
                  break;

                case 'assistant_progress':
                  // Handle inline thinking/action/result progress messages
                  const progressEntry = {
                    id: payload.progressId || nanoid(),
                    message: payload.content || '',
                    timestamp: Date.now(),
                    category: payload.category || 'action'
                  };
                  
                  // Append to current assistant message's progressMessages
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastMsgIndex = updated.length - 1;
                    const lastMsg = updated[lastMsgIndex];
                    if (lastMsg && lastMsg.role === 'assistant') {
                      // ✅ CREATE NEW MESSAGE OBJECT - React detects change!
                      updated[lastMsgIndex] = {
                        ...lastMsg,
                        progressMessages: [...(lastMsg.progressMessages || []), progressEntry]
                      };
                      return updated;
                    }
                    return prev;
                  });
                  
                  // Also update progress status for status bar
                  if (payload.category === 'thinking') {
                    setProgressStatus('thinking');
                    setProgressMessage(payload.content || 'Thinking...');
                  } else if (payload.category === 'action') {
                    setProgressStatus('working');
                    setProgressMessage(payload.content || 'Working...');
                  }
                  break;

                // RunState event handlers
                case 'run.started':
                  console.log('[RunState] Run started:', payload);
                  dispatchRunState({ type: 'run.started', data: payload as RunStartedData });
                  setProgressStatus('thinking');
                  break;

                case 'run.state_updated':
                  console.log('[RunState] State updated:', payload);
                  dispatchRunState({ type: 'run.state_updated', data: payload as RunStateUpdateData });
                  if (payload.phase) {
                    setCurrentPhase(payload.phase);
                    // Map phase to progressStatus
                    if (payload.phase === 'thinking') setProgressStatus('thinking');
                    else if (payload.phase === 'working') setProgressStatus('working');
                    else if (payload.phase === 'verifying') setProgressStatus('vibing');
                  }
                  break;

                case 'task.created':
                  console.log('[RunState] Task created:', payload);
                  dispatchRunState({ type: 'task.created', data: payload as TaskCreatedData });
                  break;

                case 'task.updated':
                  console.log('[RunState] Task updated:', payload);
                  dispatchRunState({ type: 'task.updated', data: payload as TaskUpdatedData });
                  break;

                case 'run.completed':
                  console.log('[RunState] Run completed:', payload);
                  dispatchRunState({ type: 'run.completed', data: payload as RunCompletedData });
                  setProgressStatus('idle');
                  break;

                case 'run.failed':
                  console.error('[RunState] Run failed:', payload);
                  dispatchRunState({ type: 'run.failed', data: payload as RunFailedData });
                  setProgressStatus('idle');
                  toast({
                    variant: 'destructive',
                    title: 'Run Failed',
                    description: payload.errorMessage || 'The agent run encountered an error',
                  });
                  break;

                case 'complete':
                case 'done':
                  console.log('[SSE] Stream complete event');
                  setIsGenerating(false);
                  setProgressStatus('idle');
                  setProgressMessage('');
                  
                  // ✅ DON'T refetch history - we already have the message locally from SSE
                  // Refetching causes race condition where server data overwrites local state
                  // and the message disappears (especially if progressMessages aren't saved)
                  // queryClient.invalidateQueries({ queryKey: ['/api/lomu-ai/history', effectiveProjectId] });
                  break;

                case 'progress':
                  // Handle progress updates (shown in status bar, not inline chat)
                  console.log('[SSE] Progress:', payload.message);
                  if (payload.message) {
                    setProgressMessage(payload.message);
                    
                    // If it's a warning/failure message, show toast
                    if (payload.message.includes('🚨') || payload.message.includes('failure') || payload.message.includes('Safety limit')) {
                      toast({
                        variant: payload.message.includes('🚨') ? 'destructive' : 'default',
                        title: 'LomuAI Status',
                        description: payload.message,
                      });
                    }
                  }
                  break;

                case 'error':
                  console.error('[SSE] Error event:', payload);
                  toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: payload.message || 'An error occurred while processing your request',
                  });
                  setIsGenerating(false);
                  setProgressStatus('idle');
                  setProgressMessage('');
                  break;

                // Test events
                case 'test.started':
                  console.log('[Test] Test started:', payload);
                  setTestingSession({
                    sessionId: payload.sessionId,
                    url: payload.url,
                    status: 'initializing',
                    narration: [],
                    steps: [],
                    startedAt: payload.timestamp || Date.now(),
                  });
                  break;

                case 'test.narration':
                  console.log('[Test] Narration:', payload.text);
                  setTestingSession((prev) => {
                    if (!prev || prev.sessionId !== payload.sessionId) return prev;
                    return {
                      ...prev,
                      narration: [...prev.narration, payload.text],
                    };
                  });
                  break;

                case 'test.step_update':
                  console.log('[Test] Step update:', payload.step);
                  setTestingSession((prev) => {
                    if (!prev || prev.sessionId !== payload.sessionId) return prev;
                    const existingIndex = prev.steps.findIndex(s => s.id === payload.step.id);
                    const updatedSteps = existingIndex >= 0
                      ? prev.steps.map((s, i) => i === existingIndex ? payload.step : s)
                      : [...prev.steps, payload.step];
                    return {
                      ...prev,
                      status: 'running',
                      steps: updatedSteps,
                    };
                  });
                  break;

                case 'test.screenshot':
                  console.log('[Test] Screenshot captured for step:', payload.stepId);
                  setTestingSession((prev) => {
                    if (!prev || prev.sessionId !== payload.sessionId) return prev;
                    return {
                      ...prev,
                      steps: prev.steps.map(step =>
                        step.id === payload.stepId
                          ? { ...step, screenshot: payload.screenshot }
                          : step
                      ),
                    };
                  });
                  break;

                case 'test.completed':
                  console.log('[Test] Test completed:', payload);
                  setTestingSession((prev) => {
                    if (!prev || prev.sessionId !== payload.sessionId) return prev;
                    return {
                      ...prev,
                      status: 'completed',
                      completedAt: payload.timestamp || Date.now(),
                    };
                  });
                  toast({
                    title: 'Test Completed',
                    description: `${payload.passedSteps}/${payload.totalSteps} tests passed`,
                    variant: payload.failedSteps > 0 ? 'destructive' : 'default',
                  });
                  // Auto-hide after 5 seconds
                  setTimeout(() => setTestingSession(null), 5000);
                  break;

                case 'test.failed':
                  console.error('[Test] Test failed:', payload);
                  setTestingSession((prev) => {
                    if (!prev || prev.sessionId !== payload.sessionId) return prev;
                    return {
                      ...prev,
                      status: 'failed',
                      completedAt: payload.timestamp || Date.now(),
                    };
                  });
                  toast({
                    variant: 'destructive',
                    title: 'Test Failed',
                    description: payload.error || 'Browser test encountered an error',
                  });
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
        const lastMsgIndex = updated.length - 1;
        const lastMsg = updated[lastMsgIndex];
        if (lastMsg && lastMsg.role === 'assistant') {
          // ✅ CREATE NEW MESSAGE OBJECT - React detects change!
          updated[lastMsgIndex] = {
            ...lastMsg,
            progressMessages: capturedProgress
          };
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
        {/* Messages Area - Now includes all overlays and status displays */}
        <ChatMessages 
          messages={messages}
          isGenerating={isGenerating}
          runState={runState.currentRunId ? runState.runs.get(runState.currentRunId) || null : null}
          onImageZoom={setZoomImage}
          scrollRef={scrollRef}
          messagesEndRef={messagesEndRef}
          currentPhase={currentPhase}
          phaseMessage={phaseMessage}
          currentProgress={currentProgress}
          currentMetrics={currentMetrics}
          agentTasks={agentTasks}
          streamState={{
            currentFile: streamState.currentFile ?? undefined,
            fileSummary: streamState.fileSummary ?? undefined,
            scratchpad: streamState.scratchpadEntries ?? []
          }}
          billingMetrics={billingMetrics}
          scratchpadEntries={streamState.scratchpadEntries ?? []}
          sessionId={sessionId}
          onClearScratchpad={handleClearScratchpad}
        />

        {/* Input Area */}
        <ChatInput 
          input={input}
          setInput={setInput}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onImageSelect={(files: FileList | null) => {
            if (files) {
              handleImageSelect(files);
            }
          }}
          pendingImages={pendingImages}
          uploadingImages={uploadingImages}
          onRemoveImage={removeImage}
          isGenerating={isGenerating}
        />
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

      {/* All Dialogs and Drawers */}
      <ChatDialogs 
        secretsRequest={secretsRequest}
        setSecretsRequest={setSecretsRequest}
        secretsInput={secretsInput}
        setSecretsInput={setSecretsInput}
        onSecretsSubmit={handleSecretsSubmit}
        isSubmittingSecrets={commandMutation.isPending}
        showCostPreview={showCostPreview}
        setShowCostPreview={setShowCostPreview}
        isFreeAccess={isFreeAccess}
        costData={costData}
        onCostPreviewProceed={handleCostPreviewProceed}
        pendingCommand={pendingCommand}
        setPendingCommand={setPendingCommand}
        setCostData={setCostData}
        showComplexityError={showComplexityError}
        setShowComplexityError={setShowComplexityError}
        complexityErrorMessage={complexityErrorMessage}
        onComplexityErrorProceed={() => {
          setShowComplexityError(false);
          if (pendingCommand) {
            executeCommand(pendingCommand);
            setPendingCommand("");
          }
        }}
        showDeploymentModal={showDeploymentModal}
        setShowDeploymentModal={setShowDeploymentModal}
        deployment={streamState.deployment ? {
          ...streamState.deployment,
          timestamp: typeof streamState.deployment.timestamp === 'string' 
            ? new Date(streamState.deployment.timestamp).getTime()
            : streamState.deployment.timestamp,
          // ✅ FIX: Map deployment statuses - successful/in_progress to completed/running
          status: (streamState.deployment.status === 'in_progress' 
            ? 'running' 
            : streamState.deployment.status === 'successful'
            ? 'completed'
            : streamState.deployment.status) as 'pending' | 'running' | 'failed' | 'completed',
          steps: (streamState.deployment.steps || []).map(step => ({
            id: step.id || `step-${Math.random()}`,
            name: step.name || 'Unknown',
            status: (step.status === 'in_progress' 
              ? 'running'
              : step.status === 'complete' || step.status === 'completed'
              ? 'completed'
              : step.status === 'pending'
              ? 'pending'
              : 'failed') as 'pending' | 'running' | 'failed' | 'completed',
            timestamp: step.timestamp,
            error: step.error
          }))
        } : null}
        showInsufficientCredits={showInsufficientCredits}
        setShowInsufficientCredits={setShowInsufficientCredits}
        zoomImage={zoomImage}
        setZoomImage={setZoomImage}
        testingSession={testingSession}
        setTestingSession={setTestingSession}
        showHistoryDialog={showHistoryDialog}
        setShowHistoryDialog={setShowHistoryDialog}
        selectedSessionId={selectedSessionId}
        onSessionSelect={(session) => {
          setShowHistoryDialog(false);
          const newProjectId = session.projectId || 'general';
          if (newProjectId !== projectId) {
            setTimeout(() => {
              window.location.href = `/chat/${newProjectId}`;
            }, 100);
          } else {
            console.log(`📝 [MESSAGE-HISTORY] Loading session ${session.id} for current project`);
            setSelectedSessionId(session.id);
          }
        }}
        contextDrawerOpen={contextDrawerOpen}
        setContextDrawerOpen={setContextDrawerOpen}
        agentTasks={agentTasks}
        artifacts={artifacts}
        runState={runState.currentRunId ? runState.runs.get(runState.currentRunId) || null : null}
        setActiveTaskId={setActiveTaskId}
        setShowArtifactsDrawer={setShowArtifactsDrawer}
      />
    </div>
  );
}
