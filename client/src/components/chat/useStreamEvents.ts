import { useReducer, Dispatch } from "react";
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
  | { type: 'run.failed'; data: RunFailedData }
  | { type: 'message.added'; message: Message }
  | { type: 'messages.clear' }
  | { type: 'loading.start' }
  | { type: 'loading.end' }
  | { type: 'error.set'; error: string }
  | { type: 'error.clear' };

function runStateReducer(state: RunStateReducerState, action: RunStateAction): RunStateReducerState {
  const newState = { ...state, runs: new Map(state.runs) } as UseStreamEventsState;
  
  switch (action.type) {
    case 'message.added':
      // ⚠️ CRITICAL: Deduplicate messages by ID to prevent duplicates and double postings
      const msgId = action.message.id || action.message.messageId;
      if (msgId) {
        const existingIndex = newState.messages.findIndex(m => (m.id || m.messageId) === msgId);
        if (existingIndex >= 0) {
          // Update existing message (e.g., streaming updates)
          newState.messages[existingIndex] = action.message;
        } else {
          // Add new message
          newState.messages.push(action.message);
        }
      } else {
        // Fallback: add message if no ID (shouldn't happen)
        newState.messages.push(action.message);
      }
      break;
      
    case 'messages.clear':
      newState.messages = [];
      break;
      
    case 'loading.start':
      newState.isLoading = true;
      newState.error = undefined;
      break;
      
    case 'loading.end':
      newState.isLoading = false;
      break;
      
    case 'error.set':
      newState.error = action.error;
      newState.isLoading = false;
      break;
      
    case 'error.clear':
      newState.error = undefined;
      break;
    
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

export interface Message {
  id: string;
  messageId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  runId?: string;
  progressMessages?: Array<{
    id: string;
    message: string;
    timestamp: number;
    category?: 'thinking' | 'action' | 'result';
  }>;
}

interface UseStreamEventsState extends RunStateReducerState {
  messages: Message[];
  error?: string;
  isLoading?: boolean;
}

export interface UseStreamEventsReturn {
  runState: UseStreamEventsState;
  dispatchRunState: Dispatch<RunStateAction>;
  sendMessage: (msg: { message: string; images?: string[] }) => void;
  stopRun: () => void;
  clearRunState: () => void;
  setRunState: (state: UseStreamEventsState) => void;
  clearChatHistory: () => void;
}

// Storage key for persisting messages
const MESSAGES_STORAGE_KEY = (projectId?: string, targetContext?: string) => 
  `lomu-chat-messages:${targetContext || 'platform'}:${projectId || 'general'}`;

export function useStreamEvents(options?: { projectId?: string; targetContext?: string; onProjectGenerated?: (result: any) => void; onRunCompleted?: () => void; onRunFailed?: () => void }): UseStreamEventsReturn {
  // Load persisted messages on mount
  const getInitialState = (): UseStreamEventsState => {
    try {
      // ⚠️ CRITICAL: Don't load from localStorage for platform/architect contexts or null projectIds
      // These should start fresh to avoid chat history bleeding between workspace contexts
      if (!options?.projectId || options?.targetContext === 'platform' || options?.targetContext === 'architect') {
        console.log('🆕 Starting fresh chat - skipping localStorage for workspace context');
        return {
          runs: new Map(),
          currentRunId: null,
          messages: [],
          isLoading: false,
          error: undefined,
        };
      }

      const storageKey = MESSAGES_STORAGE_KEY(options?.projectId, options?.targetContext);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const messages = JSON.parse(stored);
        // Filter out any messages older than 1 day to prevent bloat
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const recentMessages = messages.filter((msg: Message) => {
          // Keep messages without timestamp (legacy support)
          if (!msg.timestamp) return true;
          try {
            const msgTime = new Date(msg.timestamp).getTime();
            return (now - msgTime) < oneDayMs;
          } catch {
            return true; // Keep if timestamp parsing fails
          }
        });
        
        if (recentMessages.length === 0) {
          // If no recent messages, clear localStorage to prevent stale data
          localStorage.removeItem(storageKey);
          console.log('🧹 Cleared stale chat messages from localStorage');
        } else if (recentMessages.length < messages.length) {
          // If we filtered some out, update storage
          localStorage.setItem(storageKey, JSON.stringify(recentMessages));
          console.log(`✅ Filtered ${messages.length - recentMessages.length} stale messages`);
        }
        
        return {
          runs: new Map(),
          currentRunId: null,
          messages: recentMessages,
          isLoading: false,
          error: undefined,
        };
      }
    } catch (e) {
      console.warn('Failed to load messages from storage:', e);
      // Clear corrupted storage
      try {
        const storageKey = MESSAGES_STORAGE_KEY(options?.projectId, options?.targetContext);
        localStorage.removeItem(storageKey);
      } catch {}
    }
    
    return {
      runs: new Map(),
      currentRunId: null,
      messages: [],
      isLoading: false,
      error: undefined,
    };
  };

  const [runState, dispatchRunState] = useReducer(runStateReducer, getInitialState());

  // Persist messages to localStorage whenever they change
  const persistMessages = (messages: Message[]) => {
    try {
      const storageKey = MESSAGES_STORAGE_KEY(options?.projectId, options?.targetContext);
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to persist messages:', e);
    }
  };

  const sendMessage = async (msg: { message: string; images?: string[] }) => {
    try {
      dispatchRunState({ type: 'loading.start' });
      dispatchRunState({ type: 'error.clear' });

      // Add user message to state
      const userMessageId = `msg-${Date.now()}-user`;
      const userMessage: Message = {
        id: userMessageId,
        messageId: userMessageId,
        role: 'user',
        content: msg.message,
        timestamp: new Date(),
        images: msg.images && msg.images.length > 0 ? msg.images : undefined,
      };
      dispatchRunState({
        type: 'message.added',
        message: userMessage,
      });

      // Create assistant message with placeholder for streaming
      const assistantMessageId = `msg-${Date.now()}-assistant`;
      const assistantMessage: Message = {
        id: assistantMessageId,
        messageId: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      dispatchRunState({
        type: 'message.added',
        message: assistantMessage,
      });

      // Call backend API with SSE streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: msg.message,
          projectId: options?.projectId,
          targetContext: options?.targetContext || 'platform',
          images: msg.images || [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (!reader) {
        throw new Error('Response body not readable');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text_delta') {
                // Append text chunk
                fullText += data.text || '';
                // Update assistant message with new content
                assistantMessage.content = fullText;
                dispatchRunState({
                  type: 'message.added',
                  message: { ...assistantMessage },
                });
              } else if (data.type === 'done') {
                // Stream complete
                fullText = data.fullResponse || fullText;
                assistantMessage.content = fullText;
                dispatchRunState({
                  type: 'message.added',
                  message: { ...assistantMessage },
                });
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Streaming error');
              }
            } catch (e) {
              // Ignore JSON parse errors from non-data lines
              if (!line.includes('[DONE]')) {
                console.debug('SSE parse debug:', line);
              }
            }
          }
        }
      }

      // Persist to localStorage after streaming completes
      const newMessages = [...runState.messages.slice(0, -1), assistantMessage];
      persistMessages(newMessages);

      dispatchRunState({ type: 'loading.end' });

      // Trigger callbacks to unblock UI
      if (options?.onRunCompleted) options.onRunCompleted();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      console.error('Error sending message:', error);
      dispatchRunState({ type: 'error.set', error: errorMessage });
      dispatchRunState({ type: 'loading.end' });
      if (options?.onRunFailed) options.onRunFailed();
    }
  };

  const stopRun = () => {
    console.log("stopRun called");
  };

  const clearRunState = () => {
    dispatchRunState({ type: 'run.started', data: { runId: 'cleared', sessionId: '', userId: '', timestamp: new Date().toISOString(), config: { maxIterations: 10 } } } as any);
  };

  const setRunState = (state: UseStreamEventsState) => {
    console.log("setRunState called");
  };

  const clearChatHistory = () => {
    try {
      const storageKey = MESSAGES_STORAGE_KEY(options?.projectId, options?.targetContext);
      localStorage.removeItem(storageKey);
      dispatchRunState({ type: 'messages.clear' });
      console.log('🧹 Chat history cleared');
    } catch (e) {
      console.error('Failed to clear chat history:', e);
    }
  };

  return {
    runState: runState as UseStreamEventsState,
    dispatchRunState,
    sendMessage,
    stopRun,
    clearRunState,
    setRunState,
    clearChatHistory,
  };
}
