import { useState, useRef, useMemo, useReducer } from "react";
import { nanoid } from "nanoid";
import type { ProgressStep, ProgressMetrics } from "@/components/agent-progress";
import type { RunPhase, RunState, Task as RunTask, RunStartedData, RunStateUpdateData, TaskCreatedData, TaskUpdatedData, RunCompletedData, RunFailedData } from "@shared/agentEvents";

export interface CheckpointData {
  complexity: string;
  cost: number;
  estimatedTime: string;
  actions: string[];
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  id?: string;
  messageId?: string;
  source?: string;
  progressSteps?: ProgressStep[];
  checkpoint?: CheckpointData;
  isSummary?: boolean;
  images?: string[];
  progressMessages?: Array<{ id: string; message: string; timestamp: number; category?: 'thinking' | 'action' | 'result' }>;
}

interface RequiredSecret {
  key: string;
  description: string;
  getInstructions?: string;
}

export interface SecretsRequest {
  commandId: string;
  command: string;
  message: string;
  requiredSecrets: RequiredSecret[];
}

// RunState Reducer
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

export function useUniversalChatState(targetContext: 'platform' | 'project' | 'architect', projectId?: string | null) {
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
  const [agentTasks, setAgentTasks] = useState<any[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<'thinking' | 'working' | 'vibing' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [showTaskList, setShowTaskList] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<RunPhase>('complete');
  const [phaseMessage, setPhaseMessage] = useState<string>('');
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [showArtifactsDrawer, setShowArtifactsDrawer] = useState(false);

  // Deployment modal state
  const [showDeploymentModal, setShowDeploymentModal] = useState(false);

  // Testing panel state
  const [testingSession, setTestingSession] = useState<any>(null);

  // Mobile drawer state
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Billing state
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [isFreeAccess, setIsFreeAccess] = useState<boolean>(false);

  // Billing metrics
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
  const [billingWarnings, setBillingWarnings] = useState<any[]>([]);

  // Track runId
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  // RunState reducer
  const [runState, dispatchRunState] = useReducer(runStateReducer, {
    runs: new Map(),
    currentRunId: null,
  });

  // Session ID scoped to project
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
  const [costData, setCostData] = useState<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  return {
    messages, setMessages,
    input, setInput,
    copiedChatHistory, setCopiedChatHistory,
    pendingImages, setPendingImages,
    uploadingImages, setUploadingImages,
    zoomImage, setZoomImage,
    secretsRequest, setSecretsRequest,
    secretsInput, setSecretsInput,
    lastCommand, setLastCommand,
    currentProgress, setCurrentProgress,
    currentMetrics, setCurrentMetrics,
    isGenerating, setIsGenerating,
    lastChanges, setLastChanges,
    agentTasks, setAgentTasks,
    activeTaskId, setActiveTaskId,
    progressStatus, setProgressStatus,
    progressMessage, setProgressMessage,
    showTaskList, setShowTaskList,
    currentPhase, setCurrentPhase,
    phaseMessage, setPhaseMessage,
    artifacts, setArtifacts,
    showArtifactsDrawer, setShowArtifactsDrawer,
    showDeploymentModal, setShowDeploymentModal,
    testingSession, setTestingSession,
    contextDrawerOpen, setContextDrawerOpen,
    showHistoryDialog, setShowHistoryDialog,
    selectedSessionId, setSelectedSessionId,
    creditBalance, setCreditBalance,
    showInsufficientCredits, setShowInsufficientCredits,
    isFreeAccess, setIsFreeAccess,
    billingMetrics, setBillingMetrics,
    billingWarnings, setBillingWarnings,
    currentRunId, setCurrentRunId,
    runState, dispatchRunState,
    sessionId,
    showCostPreview, setShowCostPreview,
    showComplexityError, setShowComplexityError,
    complexityErrorMessage, setComplexityErrorMessage,
    pendingCommand, setPendingCommand,
    costData, setCostData,
    scrollRef, messagesEndRef,
    currentMessageId, setCurrentMessageId,
  };
}
