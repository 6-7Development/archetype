import { useEffect, useRef, useState, useCallback } from 'react';

// GLOBAL SINGLETON: Ensure only ONE WebSocket connection exists across all component instances
// This prevents React StrictMode from creating duplicate connections
let globalWs: WebSocket | null = null;
let globalConnectionInProgress = false;
const globalListeners = new Set<(msg: StreamMessage) => void>();

export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  subAgentId?: string | null;
}

export interface ScratchpadEntry {
  id: number;
  sessionId: string;
  author: string;
  role: string;
  content: string;
  entryType: string;
  metadata?: any;
  createdAt: Date;
}

export interface DeploymentStep {
  name: string;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  durationMs?: number;
  startTime?: string;
  endTime?: string;
}

interface StreamMessage {
  type: 'ai-status' | 'ai-chunk' | 'ai-thought' | 'ai-action' | 'ai-complete' | 'ai-error' | 'session-registered' | 'file_status' | 'file_summary' | 'chat-progress' | 'chat-complete' | 'chat-error' | 'task_plan' | 'task_update' | 'task_recompile' | 'sub_agent_spawn' | 'platform-metrics' | 'heal:init' | 'heal:thought' | 'heal:tool' | 'heal:write-pending' | 'heal:approved' | 'heal:rejected' | 'heal:completed' | 'heal:error' | 'approval_requested' | 'progress' | 'platform_preview_ready' | 'platform_preview_error' | 'lomu_ai_job_update' | 'scratchpad_entry' | 'scratchpad_cleared' | 'deploy.started' | 'deploy.step_update' | 'deploy.complete' | 'deploy.failed' | 'billing.estimate' | 'billing.update' | 'billing.reconciled' | 'billing.warning';
  roomId?: string;
  commandId?: string;
  data?: any;  // Generic data field for billing events
  updateType?: string;
  status?: string;
  message?: string;
  content?: string;
  thought?: string;
  action?: string;
  step?: number;
  totalSteps?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
  sessionId?: string;
  filename?: string;
  language?: string;
  filesChanged?: number | string[];
  linesAdded?: number;
  linesRemoved?: number;
  tool?: string;
  details?: any;
  filesModified?: number;
  tasks?: Task[];
  task?: Task;
  subAgentId?: string;
  subAgentPurpose?: string;
  platformMetrics?: {
    overallHealth: number;
    activeIncidents: number;
    uptime: string;
    cpuUsage: number;
    memoryUsage: number;
    uncommittedChanges: boolean;
    safety: {
      safe: boolean;
      issues: string[];
    };
    lastUpdate: string;
  };
  // Healing-specific fields
  text?: string;
  path?: string;
  directory?: string;
  diff?: string;
  changes?: Array<{ path: string; operation: string }>;
  issue?: string;
  timestamp?: string;
  // Approval-specific fields
  summary?: string;
  estimatedImpact?: string;
  messageId?: string;
  // Preview-specific fields
  manifest?: {
    sessionId: string;
    buildStatus: 'building' | 'success' | 'failed';
    artifacts: any[];
    errors: string[];
    timestamp: string;
  };
  errors?: string[];
  // Scratchpad-specific fields
  entry?: ScratchpadEntry;
  // Deployment-specific fields
  deploymentId?: string;
  commitHash?: string;
  commitMessage?: string;
  commitUrl?: string;
  platform?: 'github' | 'railway' | 'replit';
  stepName?: string;
  deploymentStatus?: 'in_progress' | 'successful' | 'failed';
  totalDurationMs?: number;
  steps?: DeploymentStep[];
  deploymentUrl?: string;
  errorMessage?: string;
}

interface StreamState {
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempt: number;
  currentStatus: string;
  currentThought: string;
  currentAction: string;
  currentStep: number;
  totalSteps: number;
  fullMessage: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  } | null;
  error: string | null;
  currentFile: {
    action: string;
    filename: string;
    language: string;
  } | null;
  fileSummary: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved?: number;
  } | null;
  chatProgress: {
    status: string;
    message: string;
    tool?: string;
    filesModified?: number;
  } | null;
  tasks: Task[];
  subAgentActive: {
    id: string;
    purpose: string;
  } | null;
  platformMetrics: {
    overallHealth: number;
    activeIncidents: number;
    uptime: string;
    cpuUsage: number;
    memoryUsage: number;
    uncommittedChanges: boolean;
    safety: {
      safe: boolean;
      issues: string[];
    };
    lastUpdate: string;
  } | null;
  progressMessages: Array<{
    id: string;
    message: string;
    timestamp: number;
  }>;
  previewReady: {
    sessionId: string;
    manifest: any;
  } | null;
  previewError: {
    sessionId: string;
    errors: string[];
  } | null;
  scratchpadEntries: ScratchpadEntry[];
  deployment: {
    deploymentId: string;
    commitHash: string;
    commitMessage: string;
    commitUrl: string;
    timestamp: string;
    platform: 'github' | 'railway' | 'replit';
    steps: DeploymentStep[];
    status: 'in_progress' | 'successful' | 'failed';
    deploymentUrl?: string;
    errorMessage?: string;
  } | null;
  billing: {
    estimate?: any;
    update?: any;
    reconciled?: any;
    warnings: any[];
  };
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useWebSocketStream(sessionId: string, userId: string = 'anonymous', expectedRoomId?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const shouldReconnectRef = useRef<boolean>(true);
  const connectionInitiatedRef = useRef<boolean>(false); // Prevent duplicate initial connections
  
  // Use refs to avoid recreating connect callback on every render
  const sessionIdRef = useRef(sessionId);
  const userIdRef = useRef(userId);
  const expectedRoomIdRef = useRef(expectedRoomId);
  
  // Update refs when props change
  useEffect(() => {
    sessionIdRef.current = sessionId;
    userIdRef.current = userId;
    expectedRoomIdRef.current = expectedRoomId;
  }, [sessionId, userId, expectedRoomId]);

  const [streamState, setStreamState] = useState<StreamState>({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempt: 0,
    currentStatus: '',
    currentThought: '',
    currentAction: '',
    currentStep: 0,
    totalSteps: 12,
    fullMessage: '',
    usage: null,
    error: null,
    currentFile: null,
    fileSummary: null,
    chatProgress: null,
    tasks: [],
    subAgentActive: null,
    platformMetrics: null,
    progressMessages: [],
    previewReady: null,
    previewError: null,
    scratchpadEntries: [],
    deployment: null,
    billing: {
      warnings: [],
    },
  });

  // NEW: State to track heal:* events
  const [healEvents, setHealEvents] = useState<StreamMessage[]>([]);

  const calculateBackoff = useCallback((attempt: number): number => {
    // Exponential backoff with jitter: delay = min(max_delay, base * 2^attempt + random)
    const exponentialDelay = Math.min(
      MAX_RECONNECT_DELAY,
      BASE_RECONNECT_DELAY * Math.pow(2, attempt)
    );
    // Add jitter (random 0-1000ms) to prevent thundering herd
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }, []);

  const connect = useCallback(() => {
    // GLOBAL SINGLETON CHECK: Prevent duplicate connections across all component instances
    if (globalWs?.readyState === WebSocket.OPEN || globalWs?.readyState === WebSocket.CONNECTING) {
      console.log('[WS] 🔒 Using existing global connection');
      wsRef.current = globalWs;
      setStreamState(prev => ({ ...prev, isConnected: true, error: null }));
      return;
    }
    
    if (globalConnectionInProgress) {
      console.log('[WS] 🔒 Global connection already in progress, waiting...');
      return;
    }
    
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStreamState(prev => ({
        ...prev,
        error: 'Maximum reconnection attempts reached. Please refresh the page.',
        isReconnecting: false,
      }));
      return;
    }
    
    globalConnectionInProgress = true;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      console.log('🔌 Attempting WebSocket connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        reconnectAttemptsRef.current = 0; // Reset on successful connection
        globalConnectionInProgress = false; // Reset global flag
        globalWs = ws; // Store as global singleton
        
        setStreamState(prev => ({
          ...prev,
          isConnected: true,
          isReconnecting: false,
          reconnectAttempt: 0,
          error: null
        }));

        // Always register session for streaming (use default 'anonymous' if no userId)
        try {
          ws.send(JSON.stringify({
            type: 'register-session',
            userId: userIdRef.current,
            sessionId: sessionIdRef.current,
          }));
        } catch (error) {
          console.error('Failed to register session:', error);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: StreamMessage = JSON.parse(event.data);

          // 🔒 ROOM FILTERING: Only process messages for the expected room
          // Skip messages that have a roomId but don't match our expected room
          if (expectedRoomIdRef.current && message.roomId && message.roomId !== expectedRoomIdRef.current) {
            console.log(`[WS-FILTER] ⏭️ Skipping message for different room: ${message.roomId} (expected: ${expectedRoomIdRef.current})`);
            return; // Silently ignore messages from other rooms
          }

          switch (message.type) {
            case 'session-registered':
              console.log('📡 WebSocket session registered:', message.sessionId);
              break;

            case 'ai-status':
              setStreamState(prev => ({
                ...prev,
                currentStatus: message.message || '',
              }));
              break;

            case 'ai-chunk':
              setStreamState(prev => ({
                ...prev,
                fullMessage: prev.fullMessage + (message.content || ''),
              }));
              break;

            case 'ai-thought':
              // 🧠 GEMINI THINKING: Display thinking indicators from thoughtSignature
              const thoughtMsg = message.content || message.thought || '';
              if (thoughtMsg) {
                setStreamState(prev => ({
                  ...prev,
                  currentThought: thoughtMsg,
                  progressMessages: [
                    ...prev.progressMessages,
                    {
                      id: `thought-${Date.now()}-${Math.random()}`,
                      message: thoughtMsg,
                      timestamp: Date.now(),
                    },
                  ],
                }));
              }
              break;

            case 'ai-action':
              // 🔧 GEMINI ACTIONS: Display action indicators (tool use, file operations)
              const actionMsg = message.content || message.action || '';
              if (actionMsg) {
                setStreamState(prev => ({
                  ...prev,
                  currentAction: actionMsg,
                  currentStep: message.step || 0,
                  totalSteps: message.totalSteps || 12,
                  progressMessages: [
                    ...prev.progressMessages,
                    {
                      id: `action-${Date.now()}-${Math.random()}`,
                      message: actionMsg,
                      timestamp: Date.now(),
                    },
                  ],
                }));
              }
              break;

            case 'ai-complete':
              setStreamState(prev => ({
                ...prev,
                usage: message.usage || null,
                currentStatus: 'completed',
                progressMessages: [], // Clear progress messages when AI completes
              }));
              break;

            case 'ai-error':
              setStreamState(prev => ({
                ...prev,
                error: message.error || 'Unknown error',
                currentStatus: 'failed',
                progressMessages: [],
              }));
              break;

            case 'file_status':
              setStreamState(prev => ({
                ...prev,
                currentFile: {
                  action: message.action || 'processing',
                  filename: message.filename || '',
                  language: message.language || 'plaintext',
                },
              }));
              break;

            case 'file_summary':
              setStreamState(prev => ({
                ...prev,
                fileSummary: {
                  filesChanged: typeof message.filesChanged === 'number' ? message.filesChanged : (Array.isArray(message.filesChanged) ? message.filesChanged.length : 0),
                  linesAdded: message.linesAdded || 0,
                  linesRemoved: message.linesRemoved,
                },
                currentFile: null, // Clear current file when summary arrives
              }));
              break;

            case 'progress':
              // Handle inline progress thoughts (like Replit Agent: "🧠 Found X", "🔧 Executed Y")
              const progressMsg = message.message || '';
              console.log('📡 Progress:', progressMsg);
              if (progressMsg) {
                setStreamState(prev => ({
                  ...prev,
                  progressMessages: [
                    ...prev.progressMessages,
                    {
                      id: `progress-${Date.now()}-${Math.random()}`,
                      message: progressMsg,
                      timestamp: Date.now(),
                    },
                  ],
                  currentAction: progressMsg, // Also show in status bar
                }));
              }
              break;

            case 'chat-progress':
              console.log('📡 Chat progress:', message.message);
              setStreamState(prev => ({
                ...prev,
                chatProgress: {
                  status: message.status || 'working',
                  message: message.message || '',
                  tool: message.tool,
                  filesModified: message.filesModified,
                },
                currentAction: message.message || '',
              }));
              break;

            case 'chat-complete':
              console.log('✅ Chat complete');
              setStreamState(prev => ({
                ...prev,
                chatProgress: {
                  status: 'done',
                  message: message.message || '✅ Complete',
                  filesModified: message.filesModified,
                },
                usage: message.usage || null,
                currentStatus: 'completed',
                progressMessages: [], // Clear progress messages when chat completes
              }));
              break;

            case 'chat-error':
              console.log('❌ Chat error:', message.error);
              setStreamState(prev => ({
                ...prev,
                error: message.error || 'Chat processing failed',
                currentStatus: 'failed',
                progressMessages: [],
                chatProgress: {
                  status: 'error',
                  message: message.error || 'Error occurred',
                },
              }));
              break;

            case 'task_plan':
              console.log('📋 Task plan received:', message.tasks);
              setStreamState(prev => ({
                ...prev,
                tasks: message.tasks || [],
              }));
              break;

            case 'task_update':
              console.log('✏️ Task update:', message.task);
              if (message.task) {
                setStreamState(prev => ({
                  ...prev,
                  tasks: prev.tasks.map(t =>
                    t.id === message.task!.id ? message.task! : t
                  ),
                }));
              }
              break;

            case 'task_recompile':
              console.log('🔄 Task recompile:', message.tasks);
              setStreamState(prev => ({
                ...prev,
                tasks: message.tasks || [],
              }));
              break;

            case 'lomu_ai_job_update':
              // Handle task management updates from LomuAI
              console.log(`📋 [TASK-MGMT] ${message.updateType}:`, message);
              if (message.updateType === 'task_list_created' && message.tasks) {
                console.log('📋 Task list created with tasks:', message.tasks);
                setStreamState(prev => ({
                  ...prev,
                  tasks: message.tasks || [],
                }));
              } else if (message.updateType === 'task_updated' && message.task) {
                console.log('✏️ Task updated:', message.task);
                setStreamState(prev => ({
                  ...prev,
                  tasks: prev.tasks.map(t =>
                    t.id === message.task!.id ? message.task! : t
                  ),
                }));
              } else if (message.updateType === 'job_progress' && message.message) {
                // Handle inline progress messages from Regular LomuAI
                console.log('📡 Job progress:', message.message);
                const progressId = `progress-${Date.now()}-${Math.random()}`;
                setStreamState(prev => ({
                  ...prev,
                  progressMessages: [
                    ...prev.progressMessages,
                    {
                      id: progressId,
                      message: message.message || '',
                      timestamp: Date.now(),
                    }
                  ],
                }));
              }
              break;

            case 'sub_agent_spawn':
              console.log('🤖 Sub-agent spawned:', message.subAgentId);
              setStreamState(prev => ({
                ...prev,
                subAgentActive: {
                  id: message.subAgentId || '',
                  purpose: message.subAgentPurpose || '',
                },
              }));
              break;

            case 'platform-metrics':
              setStreamState(prev => ({
                ...prev,
                platformMetrics: message.platformMetrics || null,
              }));
              break;

            case 'heal:init':
            case 'heal:thought':
            case 'heal:tool':
            case 'heal:write-pending':
            case 'heal:approved':
            case 'heal:rejected':
            case 'heal:completed':
            case 'heal:error':
            case 'approval_requested':
              // NEW: Expose heal events to consumers
              console.log(`🔧 [HEAL] ${message.type}:`, message);
              setHealEvents(prev => [...prev, message]);
              break;

            case 'scratchpad_entry':
              console.log('📝 Scratchpad entry:', message.entry);
              if (message.entry) {
                setStreamState(prev => ({
                  ...prev,
                  scratchpadEntries: [...prev.scratchpadEntries, message.entry!],
                }));
              }
              break;

            case 'scratchpad_cleared':
              console.log('🗑️ Scratchpad cleared');
              setStreamState(prev => ({
                ...prev,
                scratchpadEntries: [],
              }));
              break;

            case 'platform_preview_ready':
              console.log('✅ Platform preview ready:', message);
              setStreamState(prev => ({
                ...prev,
                previewReady: {
                  sessionId: message.sessionId || '',
                  manifest: message.manifest,
                },
                previewError: null, // Clear any previous errors
              }));
              break;

            case 'platform_preview_error':
              console.error('❌ Platform preview error:', message);
              setStreamState(prev => ({
                ...prev,
                previewError: {
                  sessionId: message.sessionId || '',
                  errors: message.errors || [],
                },
                previewReady: null, // Clear any previous ready state
              }));
              break;

            case 'deploy.started':
              console.log('🚀 Deployment started:', message.deploymentId);
              setStreamState(prev => ({
                ...prev,
                deployment: {
                  deploymentId: message.deploymentId || '',
                  commitHash: message.commitHash || '',
                  commitMessage: message.commitMessage || '',
                  commitUrl: message.commitUrl || '',
                  timestamp: message.timestamp || new Date().toISOString(),
                  platform: message.platform || 'github',
                  steps: message.steps || [],
                  status: 'in_progress',
                },
              }));
              break;

            case 'deploy.step_update':
              console.log('📝 Deployment step update:', message.stepName);
              setStreamState(prev => {
                if (!prev.deployment) return prev;
                
                const updatedSteps = prev.deployment.steps.map(step => {
                  if (step.name === message.stepName) {
                    return {
                      ...step,
                      status: message.deploymentStatus === 'in_progress' ? 'in_progress' as const : 
                              message.deploymentStatus === 'successful' ? 'complete' as const :
                              message.deploymentStatus === 'failed' ? 'failed' as const : step.status,
                      durationMs: (message as any).durationMs,
                    };
                  }
                  return step;
                });
                
                return {
                  ...prev,
                  deployment: {
                    ...prev.deployment,
                    steps: updatedSteps,
                  },
                };
              });
              break;

            case 'deploy.complete':
              console.log('✅ Deployment complete:', message.deploymentStatus);
              setStreamState(prev => {
                if (!prev.deployment) return prev;
                
                return {
                  ...prev,
                  deployment: {
                    ...prev.deployment,
                    status: message.deploymentStatus || 'successful',
                    steps: message.steps || prev.deployment.steps,
                    deploymentUrl: message.deploymentUrl,
                  },
                };
              });
              break;

            case 'deploy.failed':
              console.error('❌ Deployment failed:', message.errorMessage);
              setStreamState(prev => {
                if (!prev.deployment) return prev;
                
                return {
                  ...prev,
                  deployment: {
                    ...prev.deployment,
                    status: 'failed',
                    errorMessage: message.errorMessage,
                  },
                };
              });
              break;

            case 'billing.estimate':
              console.log('💰 Billing estimate:', message.data);
              setStreamState(prev => ({
                ...prev,
                billing: {
                  ...prev.billing,
                  estimate: message.data,
                  warnings: [], // RESET warnings on new run start
                },
              }));
              break;

            case 'billing.update':
              console.log('💰 Billing update:', message.data);
              setStreamState(prev => ({
                ...prev,
                billing: {
                  ...prev.billing,
                  update: message.data,
                },
              }));
              break;

            case 'billing.reconciled':
              console.log('💰 Billing reconciled:', message.data);
              setStreamState(prev => ({
                ...prev,
                billing: {
                  ...prev.billing,
                  reconciled: message.data,
                  warnings: [], // CLEAR warnings after run completes
                },
              }));
              break;

            case 'billing.warning':
              console.log('⚠️ Billing warning:', message.data);
              setStreamState(prev => ({
                ...prev,
                billing: {
                  ...prev.billing,
                  warnings: [...prev.billing.warnings, message.data],
                },
              }));
              break;
          }
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
          // Don't throw - gracefully handle malformed messages
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        globalConnectionInProgress = false; // Reset global flag on error
        setStreamState(prev => ({
          ...prev,
          error: 'Connection error',
        }));
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        setStreamState(prev => ({ ...prev, isConnected: false }));
        wsRef.current = null;
        
        // Clear global singleton if this was the global connection
        if (globalWs === ws) {
          globalWs = null;
          globalConnectionInProgress = false;
        }

        // Attempt reconnection if it was an unexpected disconnect and we should reconnect
        if (shouldReconnectRef.current && !event.wasClean) {
          reconnectAttemptsRef.current += 1;
          const backoffDelay = calculateBackoff(reconnectAttemptsRef.current - 1);

          console.log(`🔄 Reconnecting in ${Math.round(backoffDelay / 1000)}s (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

          setStreamState(prev => ({
            ...prev,
            isReconnecting: true,
            reconnectAttempt: reconnectAttemptsRef.current,
          }));

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, backoffDelay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      setStreamState(prev => ({
        ...prev,
        error: 'Failed to establish connection',
        isConnected: false,
      }));
    }
  }, [calculateBackoff]); // Removed sessionId and userId - using refs instead

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false; // Disable auto-reconnect

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket if open
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect'); // 1000 = normal closure
      wsRef.current = null;
    }
    
    // Also clear global singleton (all instances should disconnect together)
    if (globalWs) {
      globalWs.close(1000, 'Client disconnect');
      globalWs = null;
      globalConnectionInProgress = false;
    }

    setStreamState(prev => ({
      ...prev,
      isConnected: false,
      isReconnecting: false
    }));
  }, []);

  const resetState = useCallback(() => {
    setStreamState(prev => ({
      ...prev,
      currentStatus: '',
      currentThought: '',
      currentAction: '',
      currentStep: 0,
      totalSteps: 12,
      fullMessage: '',
      usage: null,
      error: null,
      currentFile: null,
      fileSummary: null,
      chatProgress: null,
      tasks: [],
      subAgentActive: null,
      platformMetrics: null,
      previewReady: null,
      previewError: null,
      deployment: null,
    }));
  }, []);

  const forceReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0; // Reset attempts
    disconnect();
    shouldReconnectRef.current = true;
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect(); // Try to connect (will use global singleton if exists)

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // On unmount: DON'T close the global connection, other components may be using it
      // Just clear our local reference
      wsRef.current = null;
    };
  }, []); // Empty dependency array - only run once on mount

  return {
    ...streamState,
    healEvents, // NEW: Expose heal events to consumers
    connect,
    disconnect,
    resetState,
    forceReconnect,
  };
}