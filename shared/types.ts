/**
 * GAP 4: TOOL ERROR STANDARDIZATION
 * Standard interface for all tool results to ensure consistent error handling
 */

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: 'timeout' | 'network' | 'validation' | 'permission' | 'not_found' | 'internal';
  metadata?: Record<string, any>;
}

/**
 * Helper to create a successful tool result
 */
export function successResult<T>(data: T, metadata?: Record<string, any>): ToolResult<T> {
  return { success: true, data, metadata };
}

/**
 * Helper to create an error tool result
 */
export function errorResult(
  error: string,
  errorType: ToolResult['errorType'] = 'internal',
  metadata?: Record<string, any>
): ToolResult {
  return { success: false, error, errorType, metadata };
}
