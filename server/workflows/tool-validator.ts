/**
 * TOOL VALIDATOR - Pre-execution validation for Replit FAST mode parity
 * Validates tool inputs, detects destructive operations, caches results
 */

import { WORKFLOW_CONFIG } from './workflow-config';

const toolResultCache = new Map<string, { result: any; expireAt: number }>();

/**
 * Get cache key for tool execution
 */
function getCacheKey(toolName: string, input: any): string {
  return `${toolName}:${JSON.stringify(input)}`;
}

/**
 * Validate tool input against schema
 */
export function validateToolInput(toolName: string, input: any, schema?: any): { valid: boolean; error?: string } {
  if (!WORKFLOW_CONFIG.tools.enableValidation) {
    return { valid: true };
  }

  // Basic validation - non-null input
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Tool input must be a non-null object' };
  }

  // Validate against schema if provided
  if (schema?.type === 'object' && schema?.required) {
    for (const field of schema.required) {
      if (!(field in input)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Check if tool requires approval (destructive operations)
 */
export function requiresApproval(toolName: string): { required: boolean; reason?: string } {
  if (WORKFLOW_CONFIG.approvalRequired.includes(toolName)) {
    return { required: true, reason: `${toolName} is a destructive operation and requires approval` };
  }
  return { required: false };
}

/**
 * Get cached result if available
 */
export function getCachedResult(toolName: string, input: any): { cached: boolean; result?: any } {
  const key = getCacheKey(toolName, input);
  const cached = toolResultCache.get(key);

  if (cached && cached.expireAt > Date.now()) {
    console.log(`♻️ [TOOL-CACHE] HIT: ${toolName}`);
    return { cached: true, result: cached.result };
  }

  if (cached) {
    toolResultCache.delete(key);
  }

  return { cached: false };
}

/**
 * Cache tool result
 */
export function cacheResult(toolName: string, input: any, result: any): void {
  const key = getCacheKey(toolName, input);
  const ttl = WORKFLOW_CONFIG.tools.resultCacheTTL;
  
  toolResultCache.set(key, {
    result,
    expireAt: Date.now() + ttl,
  });

  console.log(`💾 [TOOL-CACHE] STORE: ${toolName} (TTL: ${ttl}ms)`);
}

/**
 * Clear all cached results
 */
export function clearCache(): void {
  toolResultCache.clear();
  console.log(`🧹 [TOOL-CACHE] Cleared all cached results`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: toolResultCache.size,
    entries: Array.from(toolResultCache.keys()),
  };
}
