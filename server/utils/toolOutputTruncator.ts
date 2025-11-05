/**
 * Tool Output Truncator
 * 
 * Prevents token explosions by intelligently truncating large tool outputs
 * while preserving critical information and providing helpful summaries.
 * 
 * Critical for handling large grep results, file reads, and diagnostic outputs.
 */

// Token estimation: ~4 chars per token (conservative)
const CHARS_PER_TOKEN = 4;

// Truncation thresholds (in tokens)
const MAX_TOKENS = {
  grep: 2000,              // grep results can be massive
  read_platform_file: 3000, // Large files need truncation
  read_project_file: 3000,
  search_platform_files: 1500,
  search_codebase: 2000,
  perform_diagnosis: 2500,
  list_platform_directory: 1000,
  list_project_directory: 1000,
  bash: 2000,              // Command outputs can be large
  get_latest_lsp_diagnostics: 2000,
  default: 4000,           // Default for other tools
};

// Tools that should never be truncated (small, critical outputs)
const NO_TRUNCATION_TOOLS = new Set([
  'write_platform_file',
  'write_project_file',
  'commit_to_github',
  'create_task_list',
  'update_task',
  'read_task_list',
  'knowledge_store',
  'knowledge_search',
  'web_search',
]);

interface TruncationResult {
  content: any;
  wasTruncated: boolean;
  originalSize: number;
  truncatedSize: number;
  summary?: string;
}

/**
 * Estimate token count from character count
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Smart truncation for grep results
 */
function truncateGrepResults(result: any, maxTokens: number): TruncationResult {
  if (typeof result === 'string') {
    const lines = result.split('\n');
    const originalSize = estimateTokens(result);
    
    if (originalSize <= maxTokens) {
      return { content: result, wasTruncated: false, originalSize, truncatedSize: originalSize };
    }

    // Keep first N lines and last N lines
    const linesToKeep = Math.floor(maxTokens / 20); // ~20 tokens per line average
    const firstLines = lines.slice(0, linesToKeep);
    const lastLines = lines.slice(-linesToKeep);
    
    const truncated = [
      ...firstLines,
      `\n... [TRUNCATED ${lines.length - (linesToKeep * 2)} lines to prevent token explosion] ...\n`,
      ...lastLines
    ].join('\n');

    return {
      content: truncated,
      wasTruncated: true,
      originalSize,
      truncatedSize: estimateTokens(truncated),
      summary: `Grep found ${lines.length} matching lines. Showing first ${linesToKeep} and last ${linesToKeep} lines.`
    };
  }

  // Handle object results (files_with_matches mode)
  if (result && typeof result === 'object') {
    const str = JSON.stringify(result, null, 2);
    const originalSize = estimateTokens(str);
    
    if (originalSize <= maxTokens) {
      return { content: result, wasTruncated: false, originalSize, truncatedSize: originalSize };
    }

    // If it's an array of file paths, truncate the array
    if (Array.isArray(result)) {
      const keepCount = Math.floor(maxTokens / 10);
      const truncated = [
        ...result.slice(0, keepCount),
        `... [${result.length - keepCount} more files truncated]`
      ];
      
      return {
        content: truncated,
        wasTruncated: true,
        originalSize,
        truncatedSize: estimateTokens(JSON.stringify(truncated)),
        summary: `Found ${result.length} files. Showing first ${keepCount}.`
      };
    }

    // Otherwise, truncate the JSON string
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    const truncated = str.slice(0, maxChars) + '\n... [TRUNCATED]';
    
    return {
      content: truncated,
      wasTruncated: true,
      originalSize,
      truncatedSize: estimateTokens(truncated),
      summary: 'Large object truncated to prevent token explosion.'
    };
  }

  return { content: result, wasTruncated: false, originalSize: 0, truncatedSize: 0 };
}

/**
 * Smart truncation for file read results
 */
function truncateFileContent(result: any, maxTokens: number): TruncationResult {
  if (typeof result === 'string') {
    const originalSize = estimateTokens(result);
    
    if (originalSize <= maxTokens) {
      return { content: result, wasTruncated: false, originalSize, truncatedSize: originalSize };
    }

    const lines = result.split('\n');
    const maxChars = maxTokens * CHARS_PER_TOKEN;
    
    // Keep first portion and last portion
    const halfChars = Math.floor(maxChars / 2);
    const firstPart = result.slice(0, halfChars);
    const lastPart = result.slice(-halfChars);
    
    const truncated = `${firstPart}\n\n... [TRUNCATED ${lines.length} total lines, ${result.length} chars - showing first and last portions] ...\n\n${lastPart}`;

    return {
      content: truncated,
      wasTruncated: true,
      originalSize,
      truncatedSize: estimateTokens(truncated),
      summary: `File has ${lines.length} lines (${result.length} chars). Showing first and last portions.`
    };
  }

  // Handle object with file content
  if (result && typeof result === 'object' && result.content) {
    const contentTrunc = truncateFileContent(result.content, maxTokens);
    return {
      content: { ...result, content: contentTrunc.content },
      wasTruncated: contentTrunc.wasTruncated,
      originalSize: contentTrunc.originalSize,
      truncatedSize: contentTrunc.truncatedSize,
      summary: contentTrunc.summary
    };
  }

  return { content: result, wasTruncated: false, originalSize: 0, truncatedSize: 0 };
}

/**
 * Smart truncation for diagnosis results
 */
function truncateDiagnosisResults(result: any, maxTokens: number): TruncationResult {
  if (typeof result === 'string') {
    return truncateFileContent(result, maxTokens);
  }

  // If it's an object with findings array, limit findings
  if (result && typeof result === 'object' && Array.isArray(result.findings)) {
    const originalSize = estimateTokens(JSON.stringify(result, null, 2));
    
    if (originalSize <= maxTokens) {
      return { content: result, wasTruncated: false, originalSize, truncatedSize: originalSize };
    }

    // Keep summary stats but limit detailed findings
    const maxFindings = 20; // Show first 20 findings
    const truncated = {
      ...result,
      findings: result.findings.slice(0, maxFindings),
      _truncated: result.findings.length > maxFindings,
      _totalFindings: result.findings.length
    };

    return {
      content: truncated,
      wasTruncated: true,
      originalSize,
      truncatedSize: estimateTokens(JSON.stringify(truncated, null, 2)),
      summary: `Diagnosis found ${result.findings?.length || 0} findings. Showing first ${maxFindings}.`
    };
  }

  return { content: result, wasTruncated: false, originalSize: 0, truncatedSize: 0 };
}

/**
 * Main truncation function - routes to appropriate strategy
 */
export function truncateToolOutput(toolName: string, result: any): TruncationResult {
  // Skip truncation for tools that should never be truncated
  if (NO_TRUNCATION_TOOLS.has(toolName)) {
    return { 
      content: result, 
      wasTruncated: false, 
      originalSize: 0, 
      truncatedSize: 0 
    };
  }

  // Get max tokens for this tool
  const maxTokens = (MAX_TOKENS as any)[toolName] || MAX_TOKENS.default;

  // Route to appropriate truncation strategy
  if (toolName === 'grep') {
    return truncateGrepResults(result, maxTokens);
  }

  if (toolName === 'read_platform_file' || toolName === 'read_project_file') {
    return truncateFileContent(result, maxTokens);
  }

  if (toolName === 'perform_diagnosis') {
    return truncateDiagnosisResults(result, maxTokens);
  }

  if (toolName.includes('search') || toolName.includes('list')) {
    return truncateGrepResults(result, maxTokens); // Use grep strategy for lists/searches
  }

  // Generic truncation for other tools
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const originalSize = estimateTokens(resultStr);
  
  if (originalSize <= maxTokens) {
    return { content: result, wasTruncated: false, originalSize, truncatedSize: originalSize };
  }

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const truncated = resultStr.slice(0, maxChars) + '\n... [TRUNCATED to prevent token explosion]';

  return {
    content: truncated,
    wasTruncated: true,
    originalSize,
    truncatedSize: estimateTokens(truncated),
    summary: `Output truncated from ${originalSize} to ${estimateTokens(truncated)} tokens.`
  };
}

/**
 * Format truncation info for logging
 */
export function formatTruncationLog(toolName: string, truncResult: TruncationResult): string {
  if (!truncResult.wasTruncated) {
    return `[TOOL-OUTPUT] ${toolName}: ${truncResult.originalSize} tokens (no truncation needed)`;
  }

  return `[TOOL-OUTPUT] ${toolName}: TRUNCATED ${truncResult.originalSize} → ${truncResult.truncatedSize} tokens (saved ${truncResult.originalSize - truncResult.truncatedSize} tokens)`;
}
