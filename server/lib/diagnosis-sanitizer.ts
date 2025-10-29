/**
 * Diagnosis Sanitizer
 * 
 * Reduces token consumption from diagnostic reports by:
 * 1. Removing verbose stack traces
 * 2. Limiting file contents to first/last 100 lines
 * 3. Truncating large JSON objects
 * 4. Condensing repetitive log entries
 */

const MAX_FILE_LINES = 100; // Max lines to show from beginning/end of files
const MAX_JSON_DEPTH = 3; // Max depth for nested JSON objects
const MAX_ARRAY_ITEMS = 10; // Max items to show in arrays
const MAX_STACKTRACE_LINES = 10; // Max lines for stack traces
const MAX_LOG_ENTRIES = 50; // Max log entries to include

interface FileContent {
  path: string;
  content: string;
  size: number;
}

interface DiagnosisReport {
  timestamp?: Date;
  metrics?: any;
  errors?: any[];
  logs?: any[];
  files?: FileContent[];
  stackTraces?: string[];
  [key: string]: any;
}

/**
 * Truncate a single file's content to first/last N lines
 */
function truncateFileContent(content: string, maxLines: number = MAX_FILE_LINES): string {
  const lines = content.split('\n');
  
  if (lines.length <= maxLines * 2) {
    return content; // Already small enough
  }
  
  const firstLines = lines.slice(0, maxLines);
  const lastLines = lines.slice(-maxLines);
  const removedCount = lines.length - (maxLines * 2);
  
  return [
    ...firstLines,
    '',
    `... [TRUNCATED ${removedCount} lines for token efficiency] ...`,
    '',
    ...lastLines
  ].join('\n');
}

/**
 * Truncate stack traces to essential lines
 */
function truncateStackTrace(stackTrace: string): string {
  const lines = stackTrace.split('\n');
  
  if (lines.length <= MAX_STACKTRACE_LINES) {
    return stackTrace;
  }
  
  // Keep first few lines (error message + immediate trace) and last line (root cause)
  const keepFirst = Math.floor(MAX_STACKTRACE_LINES * 0.7);
  const keepLast = Math.floor(MAX_STACKTRACE_LINES * 0.3);
  
  return [
    ...lines.slice(0, keepFirst),
    '... [stack trace truncated]',
    ...lines.slice(-keepLast)
  ].join('\n');
}

/**
 * Truncate large JSON objects recursively
 */
function truncateJSON(obj: any, depth: number = 0): any {
  // Don't go too deep
  if (depth > MAX_JSON_DEPTH) {
    return '[TRUNCATED: Max depth reached]';
  }
  
  // Handle null/undefined/primitives
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    if (obj.length <= MAX_ARRAY_ITEMS) {
      return obj.map(item => truncateJSON(item, depth + 1));
    }
    
    return [
      ...obj.slice(0, MAX_ARRAY_ITEMS).map(item => truncateJSON(item, depth + 1)),
      `[... ${obj.length - MAX_ARRAY_ITEMS} more items truncated]`
    ];
  }
  
  // Handle objects
  const truncated: any = {};
  const keys = Object.keys(obj);
  
  for (const key of keys) {
    truncated[key] = truncateJSON(obj[key], depth + 1);
  }
  
  return truncated;
}

/**
 * Sanitize diagnosis report for AI consumption
 * 
 * @param diagnosis - Raw diagnosis report
 * @returns Sanitized report with reduced token count
 */
export function sanitizeDiagnosisForAI(diagnosis: DiagnosisReport): DiagnosisReport {
  console.log('[DIAGNOSIS-SANITIZER] Sanitizing diagnosis report...');
  
  const sanitized: DiagnosisReport = { ...diagnosis };
  
  // 1. Truncate file contents
  if (sanitized.files && Array.isArray(sanitized.files)) {
    console.log(`[DIAGNOSIS-SANITIZER] Truncating ${sanitized.files.length} files...`);
    sanitized.files = sanitized.files.map(file => ({
      ...file,
      content: truncateFileContent(file.content)
    }));
  }
  
  // 2. Truncate stack traces
  if (sanitized.stackTraces && Array.isArray(sanitized.stackTraces)) {
    console.log(`[DIAGNOSIS-SANITIZER] Truncating ${sanitized.stackTraces.length} stack traces...`);
    sanitized.stackTraces = sanitized.stackTraces.map(trace => truncateStackTrace(trace));
  }
  
  // 3. Truncate error objects (may contain large stack traces)
  if (sanitized.errors && Array.isArray(sanitized.errors)) {
    console.log(`[DIAGNOSIS-SANITIZER] Truncating ${sanitized.errors.length} error objects...`);
    sanitized.errors = sanitized.errors.map(error => {
      if (typeof error === 'object' && error !== null) {
        const truncatedError: any = { ...error };
        
        // Truncate stack property specifically
        if (truncatedError.stack && typeof truncatedError.stack === 'string') {
          truncatedError.stack = truncateStackTrace(truncatedError.stack);
        }
        
        return truncateJSON(truncatedError);
      }
      return error;
    });
  }
  
  // 4. Limit log entries
  if (sanitized.logs && Array.isArray(sanitized.logs)) {
    const originalCount = sanitized.logs.length;
    if (originalCount > MAX_LOG_ENTRIES) {
      console.log(`[DIAGNOSIS-SANITIZER] Limiting logs: ${originalCount} → ${MAX_LOG_ENTRIES}`);
      
      // Keep most recent logs
      sanitized.logs = [
        ...sanitized.logs.slice(-MAX_LOG_ENTRIES),
        { 
          level: 'info', 
          message: `[${originalCount - MAX_LOG_ENTRIES} older log entries truncated]`,
          timestamp: new Date()
        }
      ];
    }
  }
  
  // 5. Truncate metrics (if they're large nested objects)
  if (sanitized.metrics && typeof sanitized.metrics === 'object') {
    sanitized.metrics = truncateJSON(sanitized.metrics);
  }
  
  console.log('[DIAGNOSIS-SANITIZER] Sanitization complete');
  
  return sanitized;
}

/**
 * Estimate token savings from sanitization
 */
export function estimateSanitizationSavings(original: DiagnosisReport, sanitized: DiagnosisReport): number {
  const originalStr = JSON.stringify(original);
  const sanitizedStr = JSON.stringify(sanitized);
  
  const originalTokens = Math.ceil(originalStr.length / 4);
  const sanitizedTokens = Math.ceil(sanitizedStr.length / 4);
  const savings = originalTokens - sanitizedTokens;
  
  console.log('[DIAGNOSIS-SANITIZER] Token savings:');
  console.log(`  - Original: ${originalTokens.toLocaleString()} tokens`);
  console.log(`  - Sanitized: ${sanitizedTokens.toLocaleString()} tokens`);
  console.log(`  - Saved: ${savings.toLocaleString()} tokens (${Math.round((savings / originalTokens) * 100)}%)`);
  
  return savings;
}

/**
 * Sanitize tool result content (for any tool that returns large data)
 */
export function sanitizeToolResult(result: any): any {
  if (typeof result === 'string') {
    // Truncate very long strings
    if (result.length > 50000) {
      return truncateFileContent(result, 200);
    }
    return result;
  }
  
  if (typeof result === 'object' && result !== null) {
    return truncateJSON(result);
  }
  
  return result;
}
