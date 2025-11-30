/**
 * Tool execution module for BeeHive
 * Handles tool invocation, validation, and result processing
 * Extracted from massive lomuChat.ts for maintainability
 */

import { performanceMonitor } from '../../services/performanceMonitor';
import { BEEHIVE_LIMITS } from '../../config/beehiveLimits';

/**
 * Validate tool execution against limits
 */
export function validateToolExecution(
  toolName: string,
  toolCallCount: number,
  sessionApiCallCount: number
): { valid: boolean; reason?: string } {
  // Check per-iteration limit
  if (toolCallCount >= BEEHIVE_LIMITS.TOOL.MAX_PER_ITERATION) {
    return {
      valid: false,
      reason: `Too many tools in this iteration (max ${BEEHIVE_LIMITS.TOOL.MAX_PER_ITERATION})`,
    };
  }

  // Check per-session limit
  if (sessionApiCallCount >= BEEHIVE_LIMITS.API.MAX_API_CALLS_PER_SESSION) {
    return {
      valid: false,
      reason: `Session tool call limit reached (${BEEHIVE_LIMITS.API.MAX_API_CALLS_PER_SESSION})`,
    };
  }

  return { valid: true };
}

/**
 * Format tool result for agent consumption
 */
export function formatToolResult(
  toolName: string,
  result: any,
  success: boolean,
  errorMsg?: string
): string {
  if (!success) {
    return `❌ Tool failed: ${toolName}\nError: ${errorMsg}`;
  }

  // Handle different tool result types
  if (typeof result === 'string') {
    return result;
  }

  if (typeof result === 'object' && result.message) {
    return result.message;
  }

  if (typeof result === 'object' && result.content) {
    return result.content;
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Track tool execution metrics
 */
export function recordToolMetric(
  toolName: string,
  duration: number,
  success: boolean,
  error?: string
): void {
  performanceMonitor.recordMetric({
    timestamp: Date.now(),
    duration,
    tokensUsed: 0, // Will be updated by caller
    inputTokens: 0,
    outputTokens: 0,
    success,
    error,
    toolsUsed: [toolName],
  });
}

/**
 * Check if tool should trigger anti-paralysis mechanisms
 */
export function shouldTriggerAntiParalysis(
  toolName: string,
  consecutiveReadOnlyIterations: number,
  maxReadOnlyIterations: number
): boolean {
  const readOnlyTools = ['read_platform_file', 'ls', 'grep', 'bash'];
  const isReadOnly = readOnlyTools.includes(toolName);

  return isReadOnly && consecutiveReadOnlyIterations >= maxReadOnlyIterations;
}

/**
 * Get tool execution timeout based on tool type
 */
export function getToolTimeout(toolName: string): number {
  const timeouts: Record<string, number> = {
    bash: 60000, // 60s for bash
    browser_test: 120000, // 120s for browser tests
    web_search: 30000, // 30s for web search
    architect_consult: 180000, // 3min for architect consultation
  };

  return timeouts[toolName] || BEEHIVE_LIMITS.TOOL.TIMEOUT_MS;
}
