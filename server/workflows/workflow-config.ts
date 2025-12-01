/**
 * WORKFLOW CONFIGURATION - Unified Central Config for Replit FAST Mode Parity
 * Controls: continuation loops, timeouts, retries, cost tracking, phase management
 */

export const WORKFLOW_CONFIG = {
  // Chat continuation settings
  chat: {
    maxContinuations: 15, // increased from 3 to allow full work cycles
    timeoutMs: 60000, // increased for complex tasks
    maxTokens: 32000, // increased from 4096 to allow full responses
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
  
  // Cost tracking (Gemini-only architecture)
  costs: {
    gemini2_5FlashInput: 0.075 / 1000000, // per token
    gemini2_5FlashOutput: 0.30 / 1000000,
    gemini2_5ProInput: 1.50 / 1000000, // Scout Advanced
    gemini2_5ProOutput: 6.00 / 1000000,
    trackPerTool: true, // track cost per tool execution
  },
  
  // Context window management
  contextManagement: {
    maxTotalTokens: 1000000, // Gemini 1M context window
    warningThreshold: 0.95, // warn only at 95% usage (more permissive)
    emergencyPreserve: 10000, // reduced emergency buffer
    inputLimit: 100000, // removed artificial input limits
    outputLimit: 100000, // removed artificial output limits
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
 * Workflow Phase Enum - 7-Phase Workflow (Complete Linear Flow)
 * ASSESS → PLAN → EXECUTE → TEST → VERIFY → CONFIRM → COMMIT
 * 
 * Each phase is mandatory and must complete in order:
 * 1. ASSESS - Analyze & gather context
 * 2. PLAN - Create task list & strategy
 * 3. EXECUTE - Write/modify code
 * 4. TEST - Run tests & verify
 * 5. VERIFY - Final verification (LSP, build check)
 * 6. CONFIRM - Confirm completion ready
 * 7. COMMIT - Mark as done
 */
export enum WorkflowPhase {
  ASSESS = 'ASSESS',      // 1. Analyze requirements & gather context
  PLAN = 'PLAN',          // 2. Create task list & plan approach
  EXECUTE = 'EXECUTE',    // 3. Execute planned tasks (write/edit code)
  TEST = 'TEST',          // 4. Run tests & verify changes
  VERIFY = 'VERIFY',      // 5. Final verification (LSP diagnostics)
  CONFIRM = 'CONFIRM',    // 6. Confirm all checks pass
  COMMIT = 'COMMIT',      // 7. Workflow complete - mark done
  ERROR = 'ERROR',        // Recovery state (can happen at any phase)
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
