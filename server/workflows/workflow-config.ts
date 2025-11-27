/**
 * WORKFLOW CONFIGURATION - Unified Central Config for Replit FAST Mode Parity
 * Controls: continuation loops, timeouts, retries, cost tracking, phase management
 */

export const WORKFLOW_CONFIG = {
  // Chat continuation settings
  chat: {
    maxContinuations: 3,
    timeoutMs: 30000,
    maxTokens: 4096,
    contextWindowBuffer: 500, // tokens reserved for final response
  },
  
  // Tool execution settings
  tools: {
    maxParallel: 4,
    timeoutMs: 5000,
    retryCount: 2,
    resultCacheTTL: 300000, // 5 minutes
    enableValidation: true,
  },
  
  // Error recovery
  recovery: {
    autoRollback: true,
    preserveState: true,
    retryOnError: true,
    maxErrorRetries: 2,
  },
  
  // Phase management (ASSESS → PLAN → EXECUTE → TEST → VERIFY)
  phases: {
    ASSESS: { timeout: 5000, maxRetries: 1 },
    PLAN: { timeout: 8000, maxRetries: 1 },
    EXECUTE: { timeout: 15000, maxRetries: 2 },
    TEST: { timeout: 10000, maxRetries: 1 },
    VERIFY: { timeout: 5000, maxRetries: 0 },
  },
  
  // Cost tracking
  costs: {
    gemini2_5FlashInput: 0.075 / 1000000, // per token
    gemini2_5FlashOutput: 0.30 / 1000000,
    claudeSonnetInput: 3.0 / 1000000,
    claudeSonnetOutput: 15.0 / 1000000,
    trackPerTool: true, // track cost per tool execution
  },
  
  // Context window management
  contextManagement: {
    maxTotalTokens: 1000000, // Gemini 1M context
    warningThreshold: 0.8, // warn at 80% usage
    emergencyPreserve: 50000, // reserve 50k tokens
    inputLimit: 4096,
    outputLimit: 16000,
  },
  
  // Approval workflows for destructive operations
  approvalRequired: [
    'delete_file',
    'delete_directory',
    'reset_database',
    'deploy_production',
    'clear_cache',
    'format_disk',
  ],
} as const;

/**
 * Workflow Phase Enum
 */
export enum WorkflowPhase {
  ASSESS = 'ASSESS',
  PLAN = 'PLAN',
  EXECUTE = 'EXECUTE',
  TEST = 'TEST',
  VERIFY = 'VERIFY',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

/**
 * Workflow State Interface
 */
export interface WorkflowState {
  conversationId: string;
  currentPhase: WorkflowPhase;
  continuationCount: number;
  errorCount: number;
  startTime: number;
  toolsExecuted: Array<{
    name: string;
    startTime: number;
    endTime: number;
    status: 'success' | 'error' | 'timeout' | 'retry';
    costTokens: number;
    resultCached: boolean;
  }>;
  contextTokensUsed: number;
  totalCost: number;
  messages: Array<any>;
  state: Record<string, any>;
}

/**
 * Tool Execution Result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  costTokens: number;
  cached: boolean;
  retried: boolean;
  durationMs: number;
  requiresApproval: boolean;
  approvalReason?: string;
}
