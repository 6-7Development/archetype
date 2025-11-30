import type { Response } from 'express';
import type { FileChangeTracker } from '../../../services/validationHelpers.ts';
import type { WebSocketServer } from 'ws';
import type { ConversationState } from '@shared/schema';
import type { SessionState } from '../../../services/beehiveAIBrain.ts';

/**
 * Request body parameters for BeeHive stream endpoint
 * Contains all user-provided inputs for initiating a chat stream
 */
export interface StreamRequest {
  message: string;
  attachments?: Array<{
    fileName: string;
    fileType: string;
    content: string;
    mimeType: string;
    size: number;
  }>;
  autoCommit?: boolean;
  autoPush?: boolean;
  projectId?: string | null;
  sessionId?: string;
  targetContext?: 'platform' | 'project';
  extendedThinking?: boolean;
}

/**
 * Session and conversation context for the active stream
 * Contains all database entities and identifiers needed for conversation tracking
 */
export interface StreamContext {
  userId: string;
  agentRunId: string;
  conversationState: ConversationState;
  session: SessionState;
  traceId: string | null;
  autonomyLevel: 'basic' | 'standard' | 'deep' | 'max';
  targetContext: 'platform' | 'project';
  projectId: string | null;
  userMessageId: string;
}

/**
 * File change notification payload
 * Emitted when files are created, modified, or deleted
 */
export interface FileChangePayload {
  path: string;
  operation: 'create' | 'modify' | 'delete';
}

/**
 * SSE event payload interfaces
 * Each event type has a specific payload structure
 */

/**
 * User message event payload
 * Echoes back the user's input message
 */
export interface UserMessageEventPayload {
  content: string;
  messageId: string;
}

/**
 * Content event payload
 * Contains AI-generated text content
 */
export interface ContentEventPayload {
  content: string;
  messageId?: string;
}

/**
 * Tool call event payload
 * Emitted when AI invokes a tool
 */
export interface ToolCallEventPayload {
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  messageId?: string;
}

/**
 * Tool result event payload
 * Contains the result of a tool execution
 */
export interface ToolResultEventPayload {
  toolId: string;
  toolName: string;
  output: string;
  isError?: boolean;
  messageId?: string;
  // ✅ PHASE 3: Structured payload (Gap #1 fix - keep objects as objects)
  payload?: any;
  // ✅ PHASE 2: Validation metadata for UI awareness
  metadata?: {
    valid?: boolean;
    truncated?: boolean;
    warnings?: string[];
    schemaValidated?: boolean;
  };
}

/**
 * Thinking event payload
 * Contains AI's internal reasoning process
 */
export interface ThinkingEventPayload {
  content: string;
  messageId?: string;
}

/**
 * Complete event payload
 * Signals the end of streaming
 */
export interface CompleteEventPayload {
  messageId?: string;
  tokensUsed?: number;
  creditsConsumed?: number;
}

/**
 * Error event payload
 * Contains error information
 */
export interface ErrorEventPayload {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * System info event payload
 * Contains system-level information and status updates
 */
export interface SystemInfoEventPayload {
  message: string;
  severity?: 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

/**
 * File update event payload
 * Notifies clients of file system changes
 */
export interface FileUpdateEventPayload {
  file: FileChangePayload;
  targetContext?: 'platform' | 'project';
  projectId?: string | null;
}

/**
 * Approval required event payload
 * Requests user approval for potentially destructive actions
 */
export interface ApprovalRequiredEventPayload {
  approvalId: string;
  summary: string;
  filesChanged: string[];
  estimatedImpact: string;
  messageId?: string;
}

/**
 * Heartbeat event payload
 * Keep-alive signal with no additional data
 */
export interface HeartbeatEventPayload {
  timestamp?: string;
}

/**
 * SSE event types discriminated union
 * Type-safe event handling with specific payloads per event type
 */
export type SSEEvent =
  | { type: 'user_message'; data: UserMessageEventPayload }
  | { type: 'content'; data: ContentEventPayload }
  | { type: 'tool_call'; data: ToolCallEventPayload }
  | { type: 'tool_result'; data: ToolResultEventPayload }
  | { type: 'thinking'; data: ThinkingEventPayload }
  | { type: 'complete'; data: CompleteEventPayload }
  | { type: 'error'; data: ErrorEventPayload }
  | { type: 'system_info'; data: SystemInfoEventPayload }
  | { type: 'file_update'; data: FileUpdateEventPayload }
  | { type: 'approval_required'; data: ApprovalRequiredEventPayload }
  | { type: 'heartbeat'; data: HeartbeatEventPayload }
  | { type: 'progress'; data: { message: string } }
  | { type: 'assistant_progress'; data: { progressId?: string; content?: string; category?: string; message?: string; messageId?: string } }
  | { type: 'file_change'; data: { file: { path: string; operation: string } } }
  | { type: 'done'; data: Record<string, unknown> }
  | { type: 'task_updated'; data: { taskId: string; status: string; details?: string } }
  | { type: 'run_phase'; data: { phase: string; message: string } };

/**
 * Type guard for SSE events
 * Runtime type checking for event discrimination
 */
export function isSSEEvent(event: unknown): event is SSEEvent {
  if (typeof event !== 'object' || event === null) return false;
  const evt = event as Record<string, unknown>;
  return typeof evt.type === 'string' && 'data' in evt;
}

/**
 * Event sender function type
 * Strongly typed function for sending SSE events
 */
export type EventSender = <T extends SSEEvent['type']>(
  type: T,
  data: Extract<SSEEvent, { type: T }>['data']
) => void;

/**
 * Active stream state tracking
 * Contains runtime state for managing SSE connection and monitoring
 */
export interface StreamState {
  sendEvent: EventSender;
  fileChangeTracker: FileChangeTracker;
  heartbeatInterval: NodeJS.Timeout;
  streamTimeoutId: NodeJS.Timeout;
  activeStreamsKey: string;
}

/**
 * Result of request validation
 * Returned by validateContextAccess to check user permissions
 */
export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Result of billing setup
 * Returned by AgentExecutor.startRun after reserving credits
 */
export interface BillingSetupResult {
  success: boolean;
  runId?: string;
  creditsReserved?: number;
  error?: string;
  creditsNeeded?: number;
  requiresCreditPurchase?: boolean;
}

/**
 * User intent classification result
 * Determines iteration limits and response style
 */
export type UserIntent = 'build' | 'fix' | 'diagnostic' | 'casual';

/**
 * Conversation intent classification
 * Determines whether to provide brief answer or perform work
 */
export type ConversationIntent = 'question' | 'task' | 'status';

/**
 * Autonomy level configuration
 * Defines capabilities and limits for each tier
 */
export interface AutonomyLevelConfig {
  maxTokens: number;
  allowTaskTracking: boolean;
  allowWebSearch: boolean;
  allowSubAgents: boolean;
  requireApproval: boolean;
}

/**
 * Complexity detection result
 * Used to determine if extended thinking is needed
 */
export interface ComplexityResult {
  level: 'simple' | 'medium' | 'complex' | 'enterprise';
  score?: number;
  reasoning?: string;
}

/**
 * Run configuration governance
 * Mutable configuration values that can be overridden by architect/autoplan logic
 */
export interface RunConfigGovernance {
  finalExtendedThinking: boolean;
  finalAutoCommit: boolean;
  finalAutoPush: boolean;
  finalAutonomyLevel: 'basic' | 'standard' | 'deep' | 'max';
  finalMaxTokens?: number;
  userIntent: UserIntent;
  complexityLevel: string;
  complexityScore: number;
  messageLength: number;
  manualOverride: boolean;
  heuristicSuggestion: boolean;
}

/**
 * Token estimation result
 * Returned by calculateTokenEstimate for billing purposes
 */
export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  totalEstimated: number;
}

/**
 * Agent run start parameters
 * Input to AgentExecutor.startRun for creating new agent run
 */
export interface AgentRunStartParams {
  userId: string;
  projectId: string | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  targetContext: 'platform' | 'project';
  wss?: WebSocketServer;
  sessionId?: string;
}

/**
 * Tool execution input/output types
 * Generic interfaces for tool parameter validation
 */

/**
 * File operation tool input
 * Parameters for file read, write, edit operations
 */
export interface FileOperationInput {
  path: string;
  content?: string;
  oldContent?: string;
  newContent?: string;
  operation: 'read' | 'write' | 'edit' | 'delete';
}

/**
 * Shell command tool input
 * Parameters for executing shell commands
 */
export interface ShellCommandInput {
  command: string;
  cwd?: string;
  timeout?: number;
}

/**
 * Database query tool input
 * Parameters for database operations
 */
export interface DatabaseQueryInput {
  query: string;
  params?: Array<string | number | boolean>;
  operation: 'select' | 'insert' | 'update' | 'delete';
}

/**
 * Web search tool input
 * Parameters for web search operations
 */
export interface WebSearchInput {
  query: string;
  maxResults?: number;
  searchType?: 'general' | 'code' | 'documentation';
}

/**
 * Tool result wrapper
 * Standardized response format for all tool executions
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    resourcesUsed?: Record<string, number>;
    warnings?: string[];
  };
}

/**
 * Persistence operation types
 * Database CRUD operation identifiers
 */
export type PersistenceOperation = 
  | 'create_conversation_state'
  | 'update_conversation_state'
  | 'create_message'
  | 'update_message'
  | 'create_agent_run'
  | 'update_agent_run'
  | 'create_token_ledger_entry'
  | 'update_session_state';

/**
 * Persistence record payload
 * Generic payload for database operations
 */
export interface PersistencePayload<T = Record<string, unknown>> {
  operation: PersistenceOperation;
  tableName: string;
  recordId?: string;
  data: T;
  userId: string;
  timestamp: Date;
}

/**
 * Stream metrics tracking
 * Performance and usage metrics for streaming sessions
 */
export interface StreamMetrics {
  streamId: string;
  startTime: Date;
  endTime?: Date;
  totalEvents: number;
  eventsByType: Record<SSEEvent['type'], number>;
  totalTokensStreamed: number;
  averageLatency: number;
  errorsEncountered: number;
}
