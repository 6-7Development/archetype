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
 * Sanitizes control characters from DATA before JSON serialization
 * 
 * CRITICAL: This function now sanitizes at the DATA level, not the JSON string level.
 * This ensures that when the JSON is parsed later, it contains no control characters.
 * 
 * @param toolName - Name of the tool that generated the result
 * @param rawResult - Raw result from tool execution
 * @returns Validation result with sanitized string and schema validation status
 */
export function validateToolResult(
  toolName: string,
  rawResult: any
): { valid: boolean; sanitized: string; error?: string; schemaValid?: boolean } {
  try {
    // STEP 1: Sanitize control characters from data FIRST
    const cleanData = deepSanitizeControlChars(rawResult);
    
    // STEP 2: Handle different result types
    let resultObject: any;
    let schemaValid = true; // Track schema validation status
    
    if (typeof cleanData === 'string') {
      // Truncate CONTENT before creating object
      const truncatedContent = cleanData.length > 45000 
        ? cleanData.substring(0, 45000) + '\n... [content truncated by validation layer]'
        : cleanData;
      
      resultObject = {
        success: true,
        content: truncatedContent,
        toolName,
        truncated: cleanData.length > 45000
      };
    } else if (typeof cleanData === 'object' && cleanData !== null) {
      // Validate schema
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
        resultObject = validated.data;
        schemaValid = true;
      } else {
        // SCHEMA VALIDATION FAILED
        console.warn(`[VALIDATION] Tool ${toolName} schema validation failed:`, validated.error.message);
        schemaValid = false;
        // Use JSON.stringify to preserve object data instead of String() which just gives "[object Object]"
        const jsonContent = JSON.stringify(cleanData);
        resultObject = { 
          success: true, 
          content: jsonContent.length > 45000 
            ? jsonContent.substring(0, 45000) + '\n... [content truncated by validation layer]'
            : jsonContent,
          toolName,
          schemaValidationWarning: validated.error.message,
          truncated: jsonContent.length > 45000
        };
      }
      
      // Truncate CONTENT field if it's a string and too long
      if (resultObject.content && typeof resultObject.content === 'string' && resultObject.content.length > 45000) {
        resultObject.content = resultObject.content.substring(0, 45000) + '\n... [content truncated by validation layer]';
        resultObject.truncated = true;
      }
      
      // Also truncate OUTPUT field for bash commands
      if (resultObject.output && typeof resultObject.output === 'string' && resultObject.output.length > 45000) {
        resultObject.output = resultObject.output.substring(0, 45000) + '\n... [content truncated by validation layer]';
        resultObject.truncated = true;
      }
    } else {
      resultObject = { success: true, content: String(cleanData), toolName };
    }
    
    // STEP 3: Convert to JSON string (this will ALWAYS be valid JSON now)
    const jsonString = JSON.stringify(resultObject);
    
    // STEP 4: Final safety check on JSON string size
    // If somehow the entire JSON object is > 50KB, wrap in error object
    if (jsonString.length > 50000) {
      const safeError = {
        success: false,
        content: '',
        error: `Tool result too large (${jsonString.length} bytes) - truncated for safety`,
        toolName,
        truncated: true
      };
      return {
        valid: false,
        sanitized: JSON.stringify(safeError),
        error: 'Result too large after validation',
        schemaValid: false
      };
    }
    
    return {
      valid: schemaValid, // NOW PROPERLY REFLECTS SCHEMA VALIDATION
      sanitized: jsonString, // ALWAYS VALID JSON
      schemaValid
    };
  } catch (error: any) {
    console.error(`[VALIDATION] Error validating tool result for ${toolName}:`, error);
    return {
      valid: false,
      sanitized: JSON.stringify({ 
        success: false, 
        content: '', 
        error: 'Validation error', 
        toolName 
      }),
      error: error.message,
      schemaValid: false
    };
  }
}

/**
 * @deprecated No longer needed - sanitization happens in validateToolResult.
 * This function is kept for backward compatibility with existing tests.
 * TODO: Remove after updating all callers to use validateToolResult directly.
 * Tracked in: Future iteration - Consumer integration alignment
 * 
 * This function no longer performs control character removal. Control character
 * sanitization now happens at the data level in validateToolResult() before
 * JSON serialization.
 * 
 * @param result - String result to sanitize
 * @param maxLength - Maximum allowed length (default: 50000)
 * @returns Sanitized string safe for database persistence
 */
export function sanitizeToolResultForPersistence(result: string, maxLength = 50000): string {
  // For backward compatibility, just return the result
  // Control character removal now happens in validateToolResult
  if (result.length > maxLength) {
    return result.substring(0, maxLength) + '\n... [truncated]';
  }
  return result;
}
