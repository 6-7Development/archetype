import type { Response } from 'express';
import type { 
  StreamContext,
  EventSender,
  SSEEvent,
  ContentEventPayload,
  ToolCallEventPayload,
  ToolResultEventPayload,
  ThinkingEventPayload,
  SystemInfoEventPayload,
  FileUpdateEventPayload,
  CompleteEventPayload,
  ErrorEventPayload,
} from './types.ts';
import { nanoid } from 'nanoid';
import { broadcastToUser } from '../../websocket.ts';
import type { WebSocketServer } from 'ws';
import type { ToolResult } from '../../../validation/toolResultValidators.ts';

/**
 * SSE Event Emission Module
 * 
 * This module centralizes all Server-Sent Events (SSE) emission logic for BeeHive streaming.
 * It provides focused, type-safe functions for emitting different event types to the frontend.
 * 
 * Architecture:
 * - All events are strongly typed using discriminated unions from types.ts
 * - Events are sent via both SSE (for real-time streaming) and WebSocket (for presence)
 * - Thinking block detection uses pattern matching for markdown-formatted thoughts
 * - Content chunks are assembled with duplicate suppression
 * 
 * @module stream-emitter
 */

/**
 * Emit context for SSE streaming
 * Contains the sendEvent function and WebSocket server reference
 */
export interface EmitContext {
  sendEvent: EventSender;
  userId: string;
  wss: WebSocketServer | null;
  targetContext?: 'platform' | 'project';
  projectId?: string | null;
  messageId?: string;
}

/**
 * Progress message entry for persistence
 * Tracks thinking/action/result messages for inline display
 */
export interface ProgressEntry {
  id: string;
  message: string;
  timestamp: number;
  category: 'thinking' | 'action' | 'result';
}

/**
 * Chunk assembly state
 * Tracks accumulated content and prevents duplicate chunks
 */
interface ChunkState {
  fullContent: string;
  currentTextBlock: string;
  lastChunkHash: string;
}

/**
 * Create a new chunk assembly state
 */
export function createChunkState(): ChunkState {
  return {
    fullContent: '',
    currentTextBlock: '',
    lastChunkHash: '',
  };
}

/**
 * Emit a content chunk to the frontend
 * 
 * Streams text content as it arrives from the AI model.
 * Includes duplicate suppression using chunk hashing.
 * 
 * @param context - Emit context with sendEvent function
 * @param content - Text content to emit
 * @param chunkState - Chunk assembly state (optional, for duplicate suppression)
 * @returns Updated chunk state if provided
 */
export function emitContentChunk(
  context: EmitContext,
  content: string,
  chunkState?: ChunkState
): ChunkState | void {
  if (!content) return chunkState;

  // Duplicate suppression if chunk state provided
  if (chunkState) {
    const chunkHash = content.slice(-Math.min(50, content.length));
    
    if (chunkHash === chunkState.lastChunkHash && content.length > 10) {
      console.log('[SSE-EMIT] Skipped duplicate chunk:', chunkHash.substring(0, 20));
      return chunkState;
    }
    
    chunkState.lastChunkHash = chunkHash;
    chunkState.fullContent += content;
    chunkState.currentTextBlock += content;
  }

  // Emit content chunk via SSE
  context.sendEvent('content', {
    content,
    messageId: context.messageId,
  });

  return chunkState;
}

/**
 * Emit a tool call event
 * 
 * Notifies the frontend that the AI is invoking a tool.
 * Includes tool name, ID, and input parameters.
 * 
 * @param context - Emit context
 * @param toolName - Name of the tool being called
 * @param toolId - Unique identifier for this tool call
 * @param input - Tool input parameters
 */
export function emitToolCall(
  context: EmitContext,
  toolName: string,
  toolId: string,
  input: Record<string, unknown>
): void {
  context.sendEvent('tool_call', {
    toolId,
    toolName,
    input,
    messageId: context.messageId,
  });

  // Broadcast to WebSocket for real-time presence
  if (context.wss && context.userId) {
    broadcastToUser(context.wss, context.userId, {
      type: 'tool_call',
      toolName,
      toolId,
      input,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * ✅ PHASE 2: Emit a tool result event with validation metadata
 * 
 * Sends the output of a completed tool execution along with validation metadata.
 * 
 * @param context - Emit context
 * @param toolName - Name of the tool that executed
 * @param toolId - Tool call identifier
 * @param toolResult - Structured ToolResult with payload and metadata
 * @param isError - Whether the tool execution failed
 */
export function emitToolResult(
  context: EmitContext,
  toolName: string,
  toolId: string,
  toolResult: ToolResult,
  isError: boolean = false
): void {
  // Gap #1 Fix: Keep objects as objects in SSE event (don't convert to JSON string)
  const output = typeof toolResult.payload === 'string'
    ? toolResult.payload
    : JSON.stringify(toolResult.payload);

  context.sendEvent('tool_result', {
    toolId,
    toolName,
    output,
    payload: toolResult.payload, // Gap #1: Preserve structured payload
    isError,
    messageId: context.messageId,
    // ✅ PHASE 2: Include validation metadata in event
    metadata: {
      valid: toolResult.valid,
      truncated: toolResult.metadata.truncated,
      warnings: toolResult.warnings,
      schemaValidated: toolResult.metadata.schemaValidated,
    },
  });

  // Broadcast to WebSocket with truncated output
  if (context.wss && context.userId) {
    const wsOutput = typeof output === 'string' ? output.substring(0, 500) : JSON.stringify(output).substring(0, 500);
    broadcastToUser(context.wss, context.userId, {
      type: 'tool_result',
      toolName,
      toolId,
      output: wsOutput,
      isError,
      timestamp: new Date().toISOString(),
      // ✅ PHASE 2: Include metadata in WebSocket event
      metadata: {
        valid: toolResult.valid,
        truncated: toolResult.metadata.truncated,
      },
    });
  }
}

/**
 * Emit a progress update
 * 
 * Sends a status message to show what the AI is currently doing.
 * Used for long-running operations to keep the user informed.
 * 
 * @param context - Emit context
 * @param message - Progress message text
 */
export function emitProgress(
  context: EmitContext,
  message: string
): void {
  context.sendEvent('progress', {
    message,
  });
}

/**
 * Emit a system info message
 * 
 * Sends system-level information or status updates.
 * 
 * @param context - Emit context
 * @param message - System message text
 * @param severity - Message severity level
 * @param metadata - Additional metadata
 */
export function emitSystemInfo(
  context: EmitContext,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info',
  metadata?: Record<string, unknown>
): void {
  context.sendEvent('system_info', {
    message,
    severity,
    metadata,
  });
}

/**
 * Emit an error event
 * 
 * Sends an error message to the frontend.
 * 
 * @param context - Emit context
 * @param message - Error message
 * @param code - Optional error code
 * @param details - Additional error details
 */
export function emitError(
  context: EmitContext,
  message: string,
  code?: string,
  details?: Record<string, unknown>
): void {
  context.sendEvent('error', {
    message,
    code,
    details,
  });
}

/**
 * Emit a thinking block
 * 
 * Sends AI's internal reasoning/analysis as a structured progress message.
 * Thinking blocks are formatted as: **Title**\n\nContent\n\n\n
 * 
 * @param context - Emit context
 * @param title - Thinking block title
 * @param content - Thinking block content
 * @param progressMessages - Array to track progress messages (optional)
 * @returns Progress entry if array provided
 */
export function emitThinking(
  context: EmitContext,
  title: string,
  content: string,
  progressMessages?: ProgressEntry[]
): ProgressEntry | void {
  const thinkingBlock = `**${title}**\n\n${content}`;
  const progressId = nanoid();
  
  const progressEntry: ProgressEntry = {
    id: progressId,
    message: thinkingBlock,
    timestamp: Date.now(),
    category: 'thinking',
  };

  // Emit as assistant_progress event
  context.sendEvent('assistant_progress', {
    progressId,
    content: thinkingBlock,
    category: 'thinking',
    messageId: context.messageId,
  });

  // Track in progress messages array if provided
  if (progressMessages) {
    progressMessages.push(progressEntry);
    return progressEntry;
  }
}

/**
 * Emit an action progress message
 * 
 * Sends an action being performed (e.g., "Modifying file X...")
 * 
 * @param context - Emit context
 * @param title - Action title
 * @param content - Action description
 * @param progressMessages - Array to track progress messages (optional)
 * @returns Progress entry if array provided
 */
export function emitAction(
  context: EmitContext,
  title: string,
  content: string,
  progressMessages?: ProgressEntry[]
): ProgressEntry | void {
  const actionBlock = `**${title}**\n\n${content}`;
  const progressId = nanoid();
  
  const progressEntry: ProgressEntry = {
    id: progressId,
    message: actionBlock,
    timestamp: Date.now(),
    category: 'action',
  };

  context.sendEvent('assistant_progress', {
    progressId,
    content: actionBlock,
    category: 'action',
    messageId: context.messageId,
  });

  if (progressMessages) {
    progressMessages.push(progressEntry);
    return progressEntry;
  }
}

/**
 * Emit a result progress message
 * 
 * Sends the result of a completed operation
 * 
 * @param context - Emit context
 * @param title - Result title
 * @param content - Result description
 * @param progressMessages - Array to track progress messages (optional)
 * @returns Progress entry if array provided
 */
export function emitResult(
  context: EmitContext,
  title: string,
  content: string,
  progressMessages?: ProgressEntry[]
): ProgressEntry | void {
  const resultBlock = `**${title}**\n\n${content}`;
  const progressId = nanoid();
  
  const progressEntry: ProgressEntry = {
    id: progressId,
    message: resultBlock,
    timestamp: Date.now(),
    category: 'result',
  };

  context.sendEvent('assistant_progress', {
    progressId,
    content: resultBlock,
    category: 'result',
    messageId: context.messageId,
  });

  if (progressMessages) {
    progressMessages.push(progressEntry);
    return progressEntry;
  }
}

/**
 * Emit a file update notification
 * 
 * Notifies the frontend that a file was created, modified, or deleted.
 * Also broadcasts via WebSocket for live preview updates.
 * 
 * @param context - Emit context
 * @param path - File path
 * @param operation - File operation type
 */
export function emitFileUpdate(
  context: EmitContext,
  path: string,
  operation: 'create' | 'modify' | 'delete'
): void {
  // Emit SSE event
  context.sendEvent('file_change', {
    file: { path, operation },
  });

  // Broadcast via WebSocket for live preview
  if (context.wss && context.userId) {
    broadcastToUser(context.wss, context.userId, {
      type: 'file_change',
      file: { path, operation },
      targetContext: context.targetContext || 'platform',
      projectId: context.projectId,
      userId: context.userId,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit a completion event
 * 
 * Signals that the streaming response is complete.
 * 
 * @param context - Emit context
 * @param tokensUsed - Total tokens consumed (optional)
 * @param creditsConsumed - Credits charged (optional)
 */
export function emitComplete(
  context: EmitContext,
  tokensUsed?: number,
  creditsConsumed?: number
): void {
  context.sendEvent('complete', {
    messageId: context.messageId,
    tokensUsed,
    creditsConsumed,
  });
}

/**
 * Emit a final "done" event with metadata
 * 
 * Sent at the very end of streaming with summary information.
 * 
 * @param context - Emit context
 * @param metadata - Completion metadata (commitHash, filesChanged, etc.)
 */
export function emitDone(
  context: EmitContext,
  metadata?: {
    commitHash?: string;
    filesChanged?: number;
    tokensUsed?: number;
    creditsConsumed?: number;
  }
): void {
  context.sendEvent('done', {
    messageId: context.messageId,
    ...metadata,
  });
}

/**
 * Detect and REMOVE thinking blocks from streaming content
 * 
 * Scans incoming text chunks for markdown-formatted thinking blocks.
 * Pattern: **Title**\n\nContent\n\n\n
 * 
 * ⚠️ FIX: Thinking blocks are now REMOVED from output, not emitted to users.
 * Users should only see actions and results, not internal monologue.
 * 
 * @param context - Emit context
 * @param chunkState - Chunk assembly state
 * @param progressMessages - Array to track progress messages
 * @returns Updated chunk state with thinking block removed
 */
export function detectAndEmitThinkingBlocks(
  context: EmitContext,
  chunkState: ChunkState,
  progressMessages: ProgressEntry[]
): ChunkState {
  // Pattern for thinking blocks: **Title**\n\nContent\n\n\n
  const thinkingPattern = /^\*\*([A-Z][^*]+)\*\*\n\n([\s\S]+?)\n\n\n/;
  const match = chunkState.currentTextBlock.match(thinkingPattern);
  
  if (match) {
    const thinkingTitle = match[1];
    
    // ⚠️ FIX: Log for debugging but DON'T emit to users
    console.log(`[THINKING-FILTERED] Removing thinking block from output: ${thinkingTitle}`);
    
    // Remove the matched thinking block from buffer - DON'T emit it
    chunkState.currentTextBlock = chunkState.currentTextBlock.slice(match[0].length);
  }
  
  return chunkState;
}

/**
 * Assemble content chunks into final response
 * 
 * Combines all accumulated chunks and cleans up formatting.
 * Removes incomplete thinking blocks and extra whitespace.
 * 
 * @param chunkState - Chunk assembly state
 * @param options - Assembly options
 * @returns Final assembled content
 */
export function assembleChunks(
  chunkState: ChunkState,
  options: {
    removeIncompleteThinking?: boolean;
    trimWhitespace?: boolean;
    fallbackContent?: string;
  } = {}
): string {
  let finalContent = chunkState.fullContent;

  // Remove incomplete thinking blocks if requested
  if (options.removeIncompleteThinking) {
    // Remove partial **Title** blocks at the end
    finalContent = finalContent.replace(/\*\*[^*]+\*\*\s*$/g, '');
  }

  // Trim excessive whitespace
  if (options.trimWhitespace !== false) {
    finalContent = finalContent.trim();
    // Normalize multiple newlines to max 2
    finalContent = finalContent.replace(/\n{3,}/g, '\n\n');
  }

  // Fallback content if empty
  if (!finalContent && options.fallbackContent) {
    finalContent = options.fallbackContent;
  }

  return finalContent;
}

/**
 * Generate post-tool message for conversational flow
 * 
 * Creates friendly text to stream after a tool execution completes.
 * Makes the AI feel more conversational by acknowledging actions.
 * 
 * @param toolName - Name of the tool that executed
 * @param toolResult - Tool execution result
 * @returns Conversational message text
 */
export function getPostToolMessage(
  toolName: string,
  toolResult: string
): string {
  // Don't spam for read-only tools
  const readOnlyTools = new Set([
    'read_platform_file',
    'list_platform_directory',
    'search_platform_files',
    'grep',
    'search_codebase',
    'get_latest_lsp_diagnostics',
    'read_task_list',
    'knowledge_search',
    'knowledge_recall',
  ]);

  if (readOnlyTools.has(toolName)) {
    return ''; // Silent for reads
  }

  // Provide brief confirmation for write operations
  const writeTools: Record<string, string> = {
    'write_platform_file': '\n',
    'edit': '\n',
    'bash': '\n',
    'commit_to_github': '\n✅ Changes committed\n',
    'restart_workflow': '\n🔄 Server restarting...\n',
    'packager_tool': '\n✅ Packages updated\n',
  };

  return writeTools[toolName] || '';
}

/**
 * Emit iteration progress for long-running tasks
 * 
 * Shows iteration count every N steps to keep user informed.
 * 
 * @param context - Emit context
 * @param iterationCount - Current iteration number
 * @param showEvery - Show progress every N iterations (default: 5)
 */
export function emitIterationProgress(
  context: EmitContext,
  iterationCount: number,
  showEvery: number = 5
): void {
  if (iterationCount % showEvery === 0) {
    emitProgress(context, `Working (step ${iterationCount})...`);
  }
}

/**
 * Emit task update notification
 * 
 * Notifies the frontend of task status changes.
 * 
 * @param context - Emit context
 * @param taskId - Task identifier
 * @param status - New task status
 */
export function emitTaskUpdate(
  context: EmitContext,
  taskId: string,
  status: string
): void {
  context.sendEvent('task_updated', {
    taskId,
    status,
  });

  // Broadcast via WebSocket for real-time sync
  if (context.wss && context.userId) {
    broadcastToUser(context.wss, context.userId, {
      type: 'task_updated',
      taskId,
      status,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit phase transition notification
 * 
 * Notifies the frontend of phase changes (thinking → working → complete).
 * 
 * @param context - Emit context
 * @param phase - New phase name
 * @param message - Phase description
 */
export function emitPhaseTransition(
  context: EmitContext,
  phase: string,
  message: string
): void {
  context.sendEvent('run_phase', {
    phase,
    message,
  });
}

/**
 * Emit approval required event
 * 
 * Requests user approval for potentially destructive actions.
 * Stream will pause until approval/rejection is received.
 * 
 * @param context - Emit context
 * @param approvalId - Unique approval request ID
 * @param summary - Summary of changes requiring approval
 * @param filesChanged - List of files that will be modified
 * @param estimatedImpact - Description of impact
 */
export function emitApprovalRequired(
  context: EmitContext,
  approvalId: string,
  summary: string,
  filesChanged: string[],
  estimatedImpact: string
): void {
  context.sendEvent('approval_required', {
    approvalId,
    summary,
    filesChanged,
    estimatedImpact,
    messageId: context.messageId,
  });

  // Broadcast via WebSocket for UI notification
  if (context.wss && context.userId) {
    broadcastToUser(context.wss, context.userId, {
      type: 'approval_required',
      approvalId,
      summary,
      filesChanged,
      estimatedImpact,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Emit heartbeat to keep connection alive
 * 
 * Sends periodic heartbeat events to prevent connection timeouts.
 * Should be called from a setInterval.
 * 
 * @param context - Emit context
 */
export function emitHeartbeat(context: EmitContext): void {
  context.sendEvent('heartbeat', {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create an emit context from request parameters
 * 
 * Factory function to create a properly configured emit context.
 * 
 * @param sendEvent - Event sender function
 * @param userId - User identifier
 * @param wss - WebSocket server instance
 * @param options - Additional context options
 * @returns Configured emit context
 */
export function createEmitContext(
  sendEvent: EventSender,
  userId: string,
  wss: WebSocketServer | null,
  options: {
    targetContext?: 'platform' | 'project';
    projectId?: string | null;
    messageId?: string;
  } = {}
): EmitContext {
  return {
    sendEvent,
    userId,
    wss,
    targetContext: options.targetContext,
    projectId: options.projectId,
    messageId: options.messageId,
  };
}
