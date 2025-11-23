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
}

export interface UseStreamEventsReturn {
  runState: UseStreamEventsState;
  dispatchRunState: Dispatch<RunStateAction>;
  sendMessage: (msg: { message: string; images?: string[] }) => void;
  stopRun: () => void;
  clearRunState: () => void;
  setRunState: (state: UseStreamEventsState) => void;
}

export function useStreamEvents(options?: { projectId?: string; targetContext?: string; onProjectGenerated?: (result: any) => void; onRunCompleted?: () => void; onRunFailed?: () => void }): UseStreamEventsReturn {
  const [runState, dispatchRunState] = useReducer(runStateReducer, {
    runs: new Map(),
    currentRunId: null,
    messages: [],
  } as UseStreamEventsState);

  const sendMessage = async (msg: { message: string; images?: string[] }) => {
    try {
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

      if (!response.ok) throw new Error('Failed to send message');
      
      // Trigger callbacks to unblock UI
      if (options?.onRunCompleted) options.onRunCompleted();
    } catch (error) {
      console.error('Error sending message:', error);
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

  return {
    runState: runState as UseStreamEventsState,
    dispatchRunState,
    sendMessage,
    stopRun,
    clearRunState,
    setRunState,
  };
}
