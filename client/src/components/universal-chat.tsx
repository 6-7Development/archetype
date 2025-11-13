import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Key, AlertCircle, Square, ChevronDown, Copy, Check, ChevronRight, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { TaskBoard } from "@/components/task-board";
import { AgentTaskList, type AgentTask } from "@/components/agent-task-list";
import { AgentProgressDisplay } from "@/components/agent-progress-display";
import { ChatInputToolbar } from "@/components/ui/chat-input-toolbar";
import { AIModelSelector } from "@/components/ai-model-selector";
import { parseMessageContent, cleanAIResponse } from "@/lib/message-parser";
import { ScratchpadDisplay } from "@/components/scratchpad-display";
import { ArchitectNotesPanel } from "@/components/architect-notes-panel";
import { DeploymentStatusModal } from "@/components/deployment-status-modal";
import { StatusStrip } from "@/components/agent/StatusStrip";
import { TaskPane } from "@/components/agent/TaskPane";
import { ArtifactsDrawer, type Artifact as ArtifactItem } from "@/components/agent/ArtifactsDrawer";
import type { RunPhase } from "@shared/agentEvents";

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
  const [showTaskPane, setShowTaskPane] = useState(false);
  const [showArtifactsDrawer, setShowArtifactsDrawer] = useState(false);
  const [thoughts, setThoughts] = useState<Array<{id: string, content: string, timestamp: number}>>([]);
  const [isThoughtPanelOpen, setIsThoughtPanelOpen] = useState(false);

  // Deployment modal state
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);

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
  const { toast } = useToast();

  // Default greeting message
  const DEFAULT_GREETING: Message = {
    role: "assistant",
    content: targetContext === 'platform'
      ? "Hi! I'm LomuAI. I can help you diagnose and fix platform issues. What would you like me to help with?"
      : "Hi! I'm LomuAI, your self-healing development assistant. What would you like to build today?",
    timestamp: new Date(),
  };

  // Load chat history
  const effectiveProjectId = targetContext === 'platform' ? 'platform' : (projectId || 'general');
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/lomu-chat/history', effectiveProjectId],
    queryFn: async () => {
      const response = await fetch(`/api/lomu-chat/history/${effectiveProjectId}`, {
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

  // Save message mutation
  const saveMessageMutation = useMutation<void, Error, { projectId: string | null; role: string; content: string }>({
    mutationFn: async (data) => {
      await apiRequest("POST", "/api/lomu-chat/messages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/lomu-chat/history', effectiveProjectId] });
    },
  });

  // Upload image mutation
  const uploadImageMutation = useMutation<{ imageUrl: string }, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/lomu-chat/upload-image', {
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
        const response = await fetch('/api/lomu-chat/access-tier', {
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
      
      // Add to thoughts panel
      setThoughts(prev => [
        ...prev,
        {
          id: `thought-${Date.now()}-${Math.random()}`,
          content: streamState.currentThought || '',
          timestamp: Date.now(),
        }
      ]);
      setIsThoughtPanelOpen(true);
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

  // Clear thoughts when AI completes and refresh credit balance
  useEffect(() => {
    if (streamState.currentStatus === 'completed') {
      setProgressStatus('idle');
      setProgressMessage("");
      setIsGenerating(false);
      setThoughts([]);
      setIsThoughtPanelOpen(false);
      
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

  // Chat mutation - endpoint changes based on target context
  const chatMutation = useMutation<{ response: string; shouldGenerate?: boolean; command?: string; autonomous?: boolean; checkpoint?: CheckpointData }, Error, { message: string; projectId?: number | string | null; images?: string[]; sessionId: string; targetContext: string }>({
    mutationFn: async (data) => {
      const endpoint = targetContext === 'platform' ? '/api/lomu-chat' : '/api/ai-chat-conversation';
      return await apiRequest<{ response: string; shouldGenerate?: boolean; command?: string; autonomous?: boolean; checkpoint?: CheckpointData }>("POST", endpoint, data);
    },
    onSuccess: (data) => {
      const assistantMessage = {
        role: "assistant" as const,
        content: data.response,
        timestamp: new Date(),
        checkpoint: data.checkpoint,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      streamState.resetState();
      setProgressStatus('idle');
      setProgressMessage("");
      setIsGenerating(false);

      saveMessageMutation.mutate({
        projectId: targetContext === 'platform' ? null : (projectId || null),
        role: 'assistant',
        content: data.response,
      });

      if (data.shouldGenerate && data.command) {
        if ((data as any).quotaExceeded) {
          toast({
            variant: "destructive",
            title: "Usage Limit Reached",
            description: (data as any).limitReason || "You've reached your usage limit. Please upgrade your plan to continue building.",
            duration: 10000,
          });
          return;
        }
        
        if (data.autonomous || isFreeAccess) {
          executeCommand(data.command);
        } else {
          complexityMutation.mutate({ command: data.command });
        }
      }
    },
    onError: (error) => {
      streamState.resetState();
      setProgressStatus('idle');
      setProgressMessage("");
      setIsGenerating(false);

      toast({
        variant: "destructive",
        title: "Chat Error",
        description: error.message || "Failed to send message. Please try again.",
      });
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
    setProgressMessage("Analyzing your request...");

    const startTime = Date.now();

    const progressSteps: ProgressStep[] = [
      { id: "1", type: "thinking", message: "Analyzing your request...", progress: 0 },
      { id: "2", type: "thinking", message: "Designing project architecture...", progress: 0 },
      { id: "3", type: "action", message: "Generating code files...", progress: 0 },
      { id: "4", type: "action", message: "Setting up dependencies...", progress: 0 },
      { id: "5", type: "action", message: "Finalizing project...", progress: 0 },
    ];

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

    saveMessageMutation.mutate({
      projectId: targetContext === 'platform' ? null : (projectId || null),
      role: 'user',
      content: input,
    });

    chatMutation.mutate({
      message: input,
      projectId: targetContext === 'platform' ? null : (projectId || null),
      images: pendingImages.length > 0 ? pendingImages : undefined,
      sessionId,
      targetContext,
    });

    setInput("");
    setPendingImages([]);
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

  // Auto-scroll to bottom
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isGenerating]);

  return (
    <div className="flex h-full overflow-hidden bg-[hsl(220,20%,12%)] relative">
      {/* Task List Sidebar */}
      {showTaskList && agentTasks.length > 0 && (
        <div className="w-64 border-r border-[hsl(220,15%,28%)] flex-shrink-0 overflow-y-auto bg-[hsl(220,18%,16%)]">
          <div className="p-3 border-b border-[hsl(220,15%,28%)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[hsl(220,8%,98%)]">Tasks</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowTaskList(false)}
              data-testid="button-hide-tasks"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <AgentTaskList tasks={agentTasks} activeTaskId={activeTaskId} onTaskClick={setActiveTaskId} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col h-full max-h-full overflow-hidden flex-1 relative touch-none">
        {/* Changes Panel - Fixed Overlay */}
        {lastChanges && (
          <ChangesPanel
            changes={lastChanges}
            onClose={() => setLastChanges(null)}
          />
        )}

        {/* Credit Balance Display - Only show when NOT free access */}
        {!isFreeAccess && (
          <div className="px-4 py-2 border-b border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[hsl(220,10%,72%)]">Credit Balance:</span>
              <span className="font-medium text-[hsl(220,8%,98%)]" data-testid="text-credit-balance">
                {creditBalance.toLocaleString()} credits
              </span>
            </div>
          </div>
        )}

        {/* Progress Display Header */}
        {(isGenerating || chatMutation.isPending) && progressStatus !== 'idle' && (
          <div className="px-4 py-3 border-b border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-[hsl(220,8%,98%)] truncate">
                    {agentTasks.find(t => t.id === activeTaskId)?.title || 'Working...'}
                  </h2>
                  {agentTasks.length > 0 && (
                    <span className="text-xs text-[hsl(220,10%,72%)] shrink-0">
                      {agentTasks.filter(t => t.status === 'completed').length}/{agentTasks.length}
                    </span>
                  )}
                </div>
                <AgentProgressDisplay status={progressStatus} message={progressMessage} />
              </div>
              {isGenerating && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  className="shrink-0"
                  data-testid="button-stop"
                >
                  <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Header with Connection Status and Model Selector */}
        <div className="px-4 py-2 border-b border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)] flex items-center justify-between gap-4">
          <ConnectionStatus
            isConnected={streamState.isConnected}
            isReconnecting={streamState.isReconnecting}
            reconnectAttempt={streamState.reconnectAttempt}
            onReconnect={streamState.forceReconnect}
          />
          <AIModelSelector />
        </div>

        {/* Agent Status Strip - Shows current phase */}
        {isGenerating && (
          <StatusStrip 
            phase={currentPhase}
            message={phaseMessage}
            isExecuting={isGenerating}
            billingMetrics={billingMetrics}
          />
        )}

        {/* AI Progress */}
        {(currentProgress.length > 0 || isGenerating) && (
          <div className="px-6 pt-4 pb-2 bg-[hsl(220,18%,16%)] border-b border-[hsl(220,15%,28%)]">
            <AgentProgress
              steps={currentProgress}
              metrics={currentMetrics}
            />
          </div>
        )}

        {/* Task Board */}
        <TaskBoard 
          tasks={streamState.tasks || []}
          isGenerating={isGenerating || chatMutation.isPending}
          subAgentActive={streamState.subAgentActive}
          className="border-b border-[hsl(220,15%,28%)]" 
        />

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

          {/* Thought Display Panel */}
          {thoughts.length > 0 && (
            <div className="mb-2">
              <Collapsible open={isThoughtPanelOpen} onOpenChange={setIsThoughtPanelOpen}>
                <CollapsibleTrigger asChild>
                  <button 
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-md border bg-card hover-elevate active-elevate-2 text-left"
                    data-testid="button-toggle-thoughts"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Brain className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Thinking...</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {thoughts.length} {thoughts.length === 1 ? 'thought' : 'thoughts'}
                      </span>
                    </div>
                    {isThoughtPanelOpen ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {thoughts.map((thought) => (
                    <div 
                      key={thought.id} 
                      className="px-3 py-2 rounded-md bg-muted/50 border border-border/50"
                      data-testid={`thought-${thought.id}`}
                    >
                      <MarkdownRenderer content={thought.content} />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3 items-start",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : message.isSummary 
                      ? "bg-muted border border-border" 
                      : "bg-secondary text-secondary-foreground shadow-sm"
                )}>
                  {message.isSummary ? (
                    <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Earlier messages summarized for efficiency</span>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                      <MarkdownRenderer content={cleanAIResponse(parseMessageContent(message.content))} />
                    </div>
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

          {/* Streaming Indicator */}
          {chatMutation.isPending && streamState.fullMessage && (
            <div className="flex gap-3 items-start">
              <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-secondary text-secondary-foreground shadow-sm border border-border/50">
                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                  <MarkdownRenderer content={cleanAIResponse(parseMessageContent(streamState.fullMessage))} />
                </div>
              </div>
            </div>
          )}

          {/* AI Streaming Indicator */}
          {chatMutation.isPending && !streamState.fullMessage && (
            <div className="flex gap-3 items-start">
              <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-muted border border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

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
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
                rows={3}
              />
              <div className="absolute bottom-2 right-2">
                <ChatInputToolbar
                  onImageSelect={handleImageSelect}
                  disabled={chatMutation.isPending}
                />
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              variant="default"
              className="flex-shrink-0 h-12 w-12 rounded-full shadow-md hover:shadow-lg transition-all"
              data-testid="button-send-chat"
            >
              {chatMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Scratchpad Sidebar */}
      <div className="w-80 border-l border-[hsl(220,15%,28%)] hidden lg:block overflow-hidden flex flex-col" data-testid="scratchpad-panel">
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Task Pane */}
          {agentTasks.length > 0 && (
            <Collapsible open={showTaskPane} onOpenChange={setShowTaskPane}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-2 h-auto"
                  data-testid="button-toggle-task-pane"
                >
                  <span className="text-sm font-medium">Tasks ({agentTasks.length})</span>
                  {showTaskPane ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <TaskPane 
                  tasks={agentTasks.map(t => ({
                    id: t.id,
                    title: t.title,
                    status: t.status === 'completed' ? 'done' : 
                            t.status === 'in_progress' ? 'in_progress' : 
                            t.status === 'failed' ? 'blocked' : 'backlog',
                    owner: 'agent' as const,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    verification: undefined,
                    artifacts: []
                  }))}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Artifacts Drawer */}
          {artifacts.length > 0 && (
            <Collapsible open={showArtifactsDrawer} onOpenChange={setShowArtifactsDrawer}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between p-2 h-auto"
                  data-testid="button-toggle-artifacts"
                >
                  <span className="text-sm font-medium">Artifacts ({artifacts.length})</span>
                  {showArtifactsDrawer ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ArtifactsDrawer artifacts={artifacts} />
              </CollapsibleContent>
            </Collapsible>
          )}

          <ScratchpadDisplay 
            entries={streamState.scratchpadEntries}
            onClear={handleClearScratchpad}
            sessionId={sessionId}
          />
          <ArchitectNotesPanel projectId={targetContext === 'platform' ? null : (projectId || null)} />
        </div>
      </div>
      
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
                onProceed={handleCostPreviewProceed}
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
          onClose={() => setShowDeploymentModal(false)}
          deployment={streamState.deployment}
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
