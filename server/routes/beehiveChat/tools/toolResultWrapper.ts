/**
 * TOOL RESULT WRAPPER
 * Standardizes all tool execution results to a consistent ToolResult interface
 * Bridges gap between string-based handlers and structured ToolResult objects
 */

import { ToolResult } from '../../../services/toolResponseValidator';

/**
 * Parse a string result from legacy tool handlers into structured ToolResult
 */
export function parseToolResult(rawResult: string): ToolResult {
  if (!rawResult || typeof rawResult !== 'string') {
    return {
      success: false,
      error: 'Tool returned invalid result (null or non-string)',
    };
  }

  // Check for success indicators (emoji-based from toolHandler.ts)
  const isSuccess = rawResult.startsWith('✅') || 
                    rawResult.startsWith('🔍') || 
                    rawResult.includes('successfully');
  
  const isWarning = rawResult.startsWith('⚠️');
  const isError = rawResult.startsWith('❌');

  if (isError) {
    return {
      success: false,
      error: rawResult.replace(/^❌\s*/, '').trim(),
    };
  }

  if (isWarning) {
    return {
      success: true,
      data: rawResult,
      warnings: [rawResult.replace(/^⚠️\s*/, '').split('\n')[0]],
    };
  }

  return {
    success: isSuccess,
    data: rawResult,
  };
}

/**
 * Wrap a legacy string-returning tool handler into a structured ToolResult handler
 */
export function wrapToolHandler<T extends any[]>(
  handler: (...args: T) => Promise<string>,
  toolName: string
): (...args: T) => Promise<ToolResult> {
  return async (...args: T): Promise<ToolResult> => {
    const startTime = Date.now();
    
    try {
      const rawResult = await handler(...args);
      const result = parseToolResult(rawResult);
      
      // Add execution metadata
      return {
        ...result,
        data: {
          raw: rawResult,
          toolName,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `${toolName} execution failed: ${error.message}`,
        data: {
          toolName,
          executionTimeMs: Date.now() - startTime,
          stackTrace: error.stack,
        },
      };
    }
  };
}

/**
 * Execute a tool with automatic result wrapping and error propagation
 */
export async function executeToolWithWrapper(
  toolName: string,
  handler: () => Promise<string>,
  options: {
    timeout?: number;
    retryOnError?: boolean;
    maxRetries?: number;
  } = {}
): Promise<ToolResult> {
  const { timeout = 120000, retryOnError = false, maxRetries = 2 } = options;
  const startTime = Date.now();
  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts <= (retryOnError ? maxRetries : 0)) {
    attempts++;
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${timeout}ms`)), timeout);
      });

      // Race between handler and timeout
      const rawResult = await Promise.race([handler(), timeoutPromise]);
      const result = parseToolResult(rawResult);

      return {
        ...result,
        data: {
          raw: rawResult,
          toolName,
          executionTimeMs: Date.now() - startTime,
          attempts,
        },
      };
    } catch (error: any) {
      lastError = error;
      
      if (!retryOnError || attempts > maxRetries) {
        break;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
    }
  }

  return {
    success: false,
    error: `${toolName} failed after ${attempts} attempt(s): ${lastError?.message || 'Unknown error'}`,
    data: {
      toolName,
      executionTimeMs: Date.now() - startTime,
      attempts,
      stackTrace: lastError?.stack,
    },
  };
}

/**
 * Batch execute multiple tools in parallel with structured results
 */
export async function batchExecuteTools(
  tools: Array<{
    name: string;
    handler: () => Promise<string>;
    options?: { timeout?: number };
  }>
): Promise<Map<string, ToolResult>> {
  const results = new Map<string, ToolResult>();
  
  const promises = tools.map(async ({ name, handler, options }) => {
    const result = await executeToolWithWrapper(name, handler, options);
    results.set(name, result);
    return { name, result };
  });

  await Promise.allSettled(promises);
  return results;
}

/**
 * Check if a tool result indicates success
 */
export function isToolSuccess(result: ToolResult): boolean {
  return result.success === true && !result.error;
}

/**
 * Check if a tool result has warnings
 */
export function hasToolWarnings(result: ToolResult): boolean {
  return Array.isArray(result.warnings) && result.warnings.length > 0;
}

/**
 * Extract error message from tool result
 */
export function getToolError(result: ToolResult): string | undefined {
  return result.error;
}

/**
 * Format tool result for display/logging
 */
export function formatToolResult(result: ToolResult): string {
  if (result.success) {
    const warningText = result.warnings?.length 
      ? `\n⚠️ Warnings: ${result.warnings.join(', ')}`
      : '';
    return `✅ Success${warningText}\n${JSON.stringify(result.data, null, 2)}`;
  }
  
  return `❌ Failed: ${result.error}`;
}
