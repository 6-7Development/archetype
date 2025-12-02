/**
 * TOOL RESPONSE VALIDATOR - Validates and caches tool execution results
 * Prevents malformed responses from propagating + reduces API calls
 */

// ==================== INTERFACES ====================

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
}

export interface CachedToolResult extends ToolResult {
  cacheKey: string;
  cachedAt: number;
  ttl: number;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  outputSchema?: {
    type: 'object';
    properties: Record<string, any>;
  };
}

// ==================== RESPONSE VALIDATOR ====================

export class ToolResponseValidator {
  private cache: Map<string, CachedToolResult> = new Map();
  private schemas: Map<string, ToolSchema> = new Map();
  private callLog: Array<{ tool: string; timestamp: number; success: boolean }> = [];

  /**
   * Register tool schema for validation
   */
  registerSchema(schema: ToolSchema): void {
    this.schemas.set(schema.name, schema);
  }

  /**
   * Validate tool result against expected schema
   */
  validate(toolName: string, result: any): ToolResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if result is null/undefined
    if (!result) {
      errors.push(`Tool returned null or undefined`);
      return { success: false, error: errors.join('; ') };
    }

    // Check if result has success flag or follows standard format
    if (typeof result !== 'object') {
      errors.push(`Tool result is not an object (got ${typeof result})`);
      return { success: false, error: errors.join('; ') };
    }

    // Validate against schema if registered
    const schema = this.schemas.get(toolName);
    if (schema && schema.outputSchema) {
      const schemaValidation = this.validateAgainstSchema(result, schema.outputSchema);
      if (!schemaValidation.valid) {
        warnings.push(...schemaValidation.errors);
      }
    }

    // Check for common error indicators
    if (result.error && !result.success) {
      errors.push(result.error);
    }

    if (result.errors && Array.isArray(result.errors)) {
      errors.push(...result.errors);
    }

    // Check for suspicious data
    if (result.data && typeof result.data === 'string' && result.data.includes('[object Object]')) {
      warnings.push('Result contains serialized object instead of proper data');
    }

    return {
      success: errors.length === 0,
      data: result.data || result,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Cache tool result to reduce API calls
   */
  cacheResult(tool: string, params: any, result: ToolResult, ttl: number = 300000): string {
    const cacheKey = this.generateCacheKey(tool, params);
    const cached: CachedToolResult = {
      ...result,
      cacheKey,
      cachedAt: Date.now(),
      ttl,
    };

    this.cache.set(cacheKey, cached);

    // Auto-cleanup after TTL
    setTimeout(() => {
      this.cache.delete(cacheKey);
    }, ttl);

    return cacheKey;
  }

  /**
   * Get cached result if available and not expired
   */
  getCachedResult(tool: string, params: any): ToolResult | null {
    const cacheKey = this.generateCacheKey(tool, params);
    const cached = this.cache.get(cacheKey);

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.cachedAt > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return {
      success: cached.success,
      data: cached.data,
      error: cached.error,
      warnings: [...(cached.warnings || []), '[CACHED RESULT]'],
    };
  }

  /**
   * Check tool health and availability
   */
  checkToolHealth(tool: string, lookbackMinutes: number = 5): {
    healthy: boolean;
    successRate: number;
    lastFailed?: number;
  } {
    const cutoff = Date.now() - lookbackMinutes * 60 * 1000;
    const recentCalls = this.callLog.filter((c) => c.tool === tool && c.timestamp > cutoff);

    if (recentCalls.length === 0) {
      return { healthy: true, successRate: 100 };
    }

    const successCount = recentCalls.filter((c) => c.success).length;
    const successRate = (successCount / recentCalls.length) * 100;

    const lastFailed = recentCalls.find((c) => !c.success)?.timestamp;

    return {
      healthy: successRate >= 80,
      successRate,
      lastFailed,
    };
  }

  /**
   * Record tool call for health tracking
   */
  logToolCall(tool: string, success: boolean): void {
    this.callLog.push({
      tool,
      timestamp: Date.now(),
      success,
    });

    // Keep only last 1000 calls per tool
    const toolCalls = this.callLog.filter((c) => c.tool === tool);
    if (toolCalls.length > 1000) {
      const toRemove = toolCalls.length - 1000;
      this.callLog = this.callLog.filter((c) => !(c.tool === tool && toolCalls.indexOf(c) < toRemove));
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalCached: number;
    estimatedSavings: number;
    hitRate: number;
  } {
    return {
      totalCached: this.cache.size,
      estimatedSavings: this.cache.size * 5, // Estimate $0.05 per API call
      hitRate: (this.cache.size / (this.cache.size + 100)) * 100, // Rough estimate
    };
  }

  /**
   * Clear cache (e.g., on logout or session end)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Private: Generate cache key from tool + params
   */
  private generateCacheKey(tool: string, params: any): string {
    const paramsStr = JSON.stringify(params || {});
    const hash = require('crypto').createHash('sha256').update(paramsStr).digest('hex');
    return `${tool}:${hash}`;
  }

  /**
   * Private: Validate object against schema
   */
  private validateAgainstSchema(
    obj: any,
    schema: any
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!schema.properties) {
      return { valid: true, errors: [] };
    }

    for (const [key, prop] of Object.entries(schema.properties) as [string, any][]) {
      if (!obj.hasOwnProperty(key)) {
        if (prop.required) {
          errors.push(`Missing required property: ${key}`);
        }
        continue;
      }

      const value = obj[key];
      const propType = prop.type;

      // Type checking
      if (propType === 'string' && typeof value !== 'string') {
        errors.push(`Property ${key} should be string, got ${typeof value}`);
      } else if (propType === 'number' && typeof value !== 'number') {
        errors.push(`Property ${key} should be number, got ${typeof value}`);
      } else if (propType === 'boolean' && typeof value !== 'boolean') {
        errors.push(`Property ${key} should be boolean, got ${typeof value}`);
      } else if (propType === 'array' && !Array.isArray(value)) {
        errors.push(`Property ${key} should be array, got ${typeof value}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

// Export singleton
export const toolResponseValidator = new ToolResponseValidator();

/**
 * Parse raw tool result string into structured ToolResult
 * Converts legacy string-based tool responses to structured format
 */
export function parseToolResult(rawResult: string | any): ToolResult {
  // If already a ToolResult object, return as-is
  if (typeof rawResult === 'object' && rawResult !== null && 'success' in rawResult) {
    return rawResult as ToolResult;
  }
  
  // Handle string results
  if (typeof rawResult === 'string') {
    // Check for success indicators
    const isSuccess = rawResult.startsWith('✅') || 
                      rawResult.includes('successfully') ||
                      rawResult.includes('complete') ||
                      !rawResult.startsWith('❌');
    
    // Check for error indicators  
    const isError = rawResult.startsWith('❌') ||
                    rawResult.toLowerCase().includes('error') ||
                    rawResult.toLowerCase().includes('failed');
    
    // Check for warning indicators
    const isWarning = rawResult.startsWith('⚠️') ||
                      rawResult.toLowerCase().includes('warning');
    
    return {
      success: isSuccess && !isError,
      data: rawResult,
      error: isError ? rawResult : undefined,
      warnings: isWarning ? [rawResult] : undefined,
    };
  }
  
  // Handle other types (arrays, objects without success field)
  return {
    success: true,
    data: rawResult,
  };
}

/**
 * Convert ToolResult to JSON for Gemini conversation history
 */
export function toolResultToJSON(result: ToolResult): string {
  if (result.success) {
    if (typeof result.data === 'string') {
      return result.data;
    }
    return JSON.stringify(result.data, null, 2);
  }
  return `Error: ${result.error}`;
}
