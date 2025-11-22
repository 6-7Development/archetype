import { z } from 'zod';

/**
 * Tool Result Validators
 * 
 * Validates and sanitizes tool execution results before persistence to prevent
 * malformed data from corrupting conversation history.
 * 
 * CRITICAL: Sanitization happens at DATA level before JSON serialization,
 * not on the JSON string after. This ensures JSON.parse() never rehydrates
 * control characters.
 * 
 * Flow: AgentExecutor.executeTool() → validateToolResult() → clean data → JSON.stringify()
 */

/**
 * Typed tool result with structured metadata
 * Replaces opaque JSON strings with typed discriminated union
 */
export type ToolResult = {
  toolName: string;
  valid: boolean;
  payload: any; // The actual tool output (sanitized)
  warnings: string[]; // Validation warnings, truncation notices, etc.
  metadata: {
    truncated?: boolean;
    originalSize?: number;
    schemaValidated?: boolean;
  };
};

/**
 * Helper to convert ToolResult to JSON for backward compatibility
 */
export function toolResultToJSON(result: ToolResult): string {
  return JSON.stringify({
    success: result.valid,
    content: typeof result.payload === 'string' ? result.payload : JSON.stringify(result.payload),
    toolName: result.toolName,
    truncated: result.metadata.truncated,
    warnings: result.warnings,
    ...result.metadata
  });
}

/**
 * Helper to parse JSON back to ToolResult
 */
export function parseToolResult(json: string): ToolResult {
  const parsed = JSON.parse(json);
  return {
    toolName: parsed.toolName,
    valid: parsed.success !== false,
    payload: parsed.content,
    warnings: parsed.warnings || [],
    metadata: {
      truncated: parsed.truncated,
      originalSize: parsed.originalSize,
      schemaValidated: parsed.schemaValidated
    }
  };
}

/**
 * Base schema for all tool results
 */
const baseToolResultSchema = z.object({
  success: z.boolean(),
  content: z.string(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

/**
 * Validators for specific tool outputs
 */
export const toolResultSchemas = {
  // File operation results (read, write, edit)
  fileOperation: z.object({
    success: z.boolean(),
    path: z.string().optional(),
    content: z.string().optional(),
    error: z.string().optional(),
    linesRead: z.number().optional(),
    bytesWritten: z.number().optional()
  }),
  
  // Command execution results (bash)
  commandExecution: z.object({
    success: z.boolean(),
    output: z.string(),
    exitCode: z.number().optional(),
    error: z.string().optional(),
    duration: z.number().optional()
  }),
  
  // Search results (search_codebase, grep, glob)
  searchResult: z.object({
    success: z.boolean(),
    matches: z.array(z.string()).optional(),
    count: z.number().optional(),
    error: z.string().optional()
  }),
  
  // Task list results
  taskList: z.object({
    success: z.boolean(),
    tasks: z.array(z.object({
      id: z.string(),
      content: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed']),
      architect_reviewed: z.string().nullable().optional()
    })).optional(),
    error: z.string().optional()
  })
};

/**
 * Recursively sanitize data structures to remove control characters
 * BEFORE JSON serialization to prevent control chars in parsed output
 * 
 * This function is called BEFORE JSON.stringify() to ensure that when
 * the JSON is later parsed, the data contains no control characters.
 * 
 * @param data - Any data structure to sanitize
 * @param seen - Set of already visited objects to detect circular references
 * @returns Sanitized data with control characters removed
 */
function deepSanitizeControlChars(data: any, seen: WeakSet<object> = new WeakSet()): any {
  if (typeof data === 'string') {
    // Remove control characters (except newlines and tabs)
    return data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  
  if (Array.isArray(data)) {
    // Detect circular reference in arrays
    if (seen.has(data)) {
      return '[Circular]';
    }
    seen.add(data);
    return data.map(item => deepSanitizeControlChars(item, seen));
  }
  
  if (data && typeof data === 'object') {
    // Detect circular reference in objects
    if (seen.has(data)) {
      return '[Circular]';
    }
    seen.add(data);
    
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      // Sanitize both key and value
      const cleanKey = typeof key === 'string' ? key.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') : key;
      sanitized[cleanKey] = deepSanitizeControlChars(value, seen);
    }
    return sanitized;
  }
  
  return data; // Primitive types (numbers, booleans, null)
}

/**
 * Validate tool result format
 * Returns typed ToolResult with structured metadata instead of JSON string
 * 
 * CRITICAL: This function now returns a typed ToolResult object with:
 * - toolName: The name of the tool
 * - valid: Whether the result passed validation
 * - payload: The sanitized tool output (primitives, arrays, or objects)
 * - warnings: Array of validation warnings and truncation notices
 * - metadata: Structured metadata (truncated, originalSize, schemaValidated)
 * 
 * @param toolName - Name of the tool that generated the result
 * @param rawResult - Raw result from tool execution
 * @returns ToolResult with structured validation metadata
 */
export function validateToolResult(
  toolName: string,
  rawResult: any
): ToolResult {
  const warnings: string[] = [];
  let valid = true;
  let schemaValidated = false;
  
  try {
    // STEP 1: Sanitize control characters from data
    const cleanData = deepSanitizeControlChars(rawResult);
    
    // STEP 2: Determine result type and validate
    let payload: any;
    let originalSize = 0;
    
    // Handle primitives (string, number, boolean, null)
    if (typeof cleanData === 'string') {
      originalSize = cleanData.length;
      if (cleanData.length > 45000) {
        payload = cleanData.substring(0, 45000) + '\n... [content truncated]';
        warnings.push(`Content truncated from ${originalSize} to 45000 chars`);
      } else {
        payload = cleanData;
      }
      schemaValidated = true; // Strings are always valid
      
    } else if (typeof cleanData === 'number' || typeof cleanData === 'boolean' || cleanData === null) {
      payload = cleanData;
      schemaValidated = true; // Primitives are always valid
      
    } else if (Array.isArray(cleanData)) {
      // Arrays: validate elements, truncate if needed
      payload = cleanData;
      originalSize = JSON.stringify(cleanData).length;
      if (originalSize > 45000) {
        const truncatedArray = [];
        let currentSize = 2; // Start with "[]"
        for (const item of cleanData) {
          const itemSize = JSON.stringify(item).length;
          if (currentSize + itemSize > 45000) break;
          truncatedArray.push(item);
          currentSize += itemSize + 1; // +1 for comma
        }
        payload = truncatedArray;
        warnings.push(`Array truncated from ${cleanData.length} to ${truncatedArray.length} items`);
      }
      schemaValidated = true; // Accept any array
      
    } else if (typeof cleanData === 'object' && cleanData !== null) {
      // Objects: validate against schema
      let schema = baseToolResultSchema;
      if (['read', 'write', 'edit'].includes(toolName)) {
        schema = toolResultSchemas.fileOperation;
      } else if (toolName === 'bash') {
        schema = toolResultSchemas.commandExecution;
      } else if (['search_codebase', 'grep', 'glob'].includes(toolName)) {
        schema = toolResultSchemas.searchResult;
      } else if (['create_task_list', 'read_task_list'].includes(toolName)) {
        schema = toolResultSchemas.taskList;
      }
      
      const validated = schema.safeParse(cleanData);
      if (validated.success) {
        payload = validated.data;
        schemaValidated = true;
      } else {
        warnings.push(`Schema validation failed: ${validated.error.message}`);
        payload = cleanData; // Keep original data even if schema fails
        valid = false; // Mark as invalid
        schemaValidated = false;
      }
      
      // Truncate content/output fields
      if (payload.content && typeof payload.content === 'string') {
        originalSize = payload.content.length;
        if (payload.content.length > 45000) {
          payload.content = payload.content.substring(0, 45000) + '\n... [content truncated]';
          warnings.push(`Content field truncated from ${originalSize} to 45000 chars`);
        }
      }
      if (payload.output && typeof payload.output === 'string') {
        const outputSize = payload.output.length;
        if (payload.output.length > 45000) {
          payload.output = payload.output.substring(0, 45000) + '\n... [output truncated]';
          warnings.push(`Output field truncated from ${outputSize} to 45000 chars`);
        }
      }
      
    } else {
      // Unexpected type
      payload = String(cleanData);
      warnings.push(`Unexpected result type: ${typeof cleanData}`);
      valid = false;
    }
    
    // STEP 3: Final size check on serialized payload
    const jsonSize = JSON.stringify(payload).length;
    if (jsonSize > 50000) {
      warnings.push(`Result too large (${jsonSize} bytes) - wrapped in error`);
      return {
        toolName,
        valid: false,
        payload: { error: `Result too large (${jsonSize} bytes)` },
        warnings,
        metadata: {
          truncated: true,
          originalSize: jsonSize,
          schemaValidated: false
        }
      };
    }
    
    // Return structured result
    return {
      toolName,
      valid,
      payload,
      warnings,
      metadata: {
        truncated: warnings.some(w => w.includes('truncated')),
        originalSize,
        schemaValidated
      }
    };
    
  } catch (error: any) {
    console.error(`[VALIDATION] Error validating tool result for ${toolName}:`, error);
    return {
      toolName,
      valid: false,
      payload: { error: 'Validation error' },
      warnings: [error.message],
      metadata: {
        truncated: false,
        schemaValidated: false
      }
    };
  }
}
