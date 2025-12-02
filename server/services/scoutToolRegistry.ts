/**
 * Scout Tool Registry & Validator
 * 
 * Central registry for all Scout tools with validation,
 * calling ability verification, and error handling
 */

import {
  SCOUT_TOOLS,
  SCOUT_AI_SERVICES,
  validateToolCall,
  getToolById,
  getAllToolIds,
} from '../config/scout-agent-config';

export interface ToolCallAttempt {
  toolId: string;
  params: Record<string, any>;
  timestamp: Date;
  status: 'success' | 'failed' | 'pending';
  error?: string;
  result?: any;
  executionTimeMs?: number;
}

export interface ScoutToolCapability {
  toolId: string;
  isAvailable: boolean;
  reason?: string;
  dependencies: string[];
}

class ScoutToolRegistry {
  private callHistory: ToolCallAttempt[] = [];
  private toolCache: Map<string, ScoutToolCapability> = new Map();

  constructor() {
    console.log('[SCOUT-TOOLS] Tool Registry initialized with', SCOUT_TOOLS.length, 'tools');
    this.validateToolAvailability();
  }

  private validateToolAvailability(): void {
    console.log('[SCOUT-TOOLS] Validating tool availability...');

    for (const tool of SCOUT_TOOLS) {
      const capability = this.checkToolCapability(tool.id);
      console.log(
        `[SCOUT-TOOLS] ${tool.name}: ${capability.isAvailable ? '✅' : '❌'} ${capability.reason || ''}`
      );
    }
  }

  checkToolCapability(toolId: string): ScoutToolCapability {
    if (this.toolCache.has(toolId)) {
      return this.toolCache.get(toolId)!;
    }

    const tool = getToolById(toolId);
    if (!tool) {
      const capability: ScoutToolCapability = {
        toolId,
        isAvailable: false,
        reason: 'Tool not found in registry',
        dependencies: [],
      };
      this.toolCache.set(toolId, capability);
      return capability;
    }

    const dependencies: string[] = [];
    let isAvailable = true;
    let reason = '';

    // Check AI service dependency
    if (tool.requiresAIService) {
      const aiService = SCOUT_AI_SERVICES.find(s => s.id === tool.requiresAIService);
      if (!aiService) {
        isAvailable = false;
        reason = `AI service not found: ${tool.requiresAIService}`;
      } else if (aiService.status === 'required' && !process.env[aiService.apiKeyEnv]) {
        isAvailable = false;
        reason = `Missing API key: ${aiService.apiKeyEnv}`;
      }
      if (aiService) {
        dependencies.push(tool.requiresAIService);
      }
    }

    // Check database requirement
    if (tool.requiresDatabase && !process.env.DATABASE_URL) {
      isAvailable = false;
      reason = 'Database not configured: DATABASE_URL missing';
      dependencies.push('database');
    }

    // Check auth requirement
    if (tool.requiresAuth) {
      dependencies.push('authentication');
    }

    const capability: ScoutToolCapability = {
      toolId,
      isAvailable,
      reason: reason || 'OK',
      dependencies,
    };

    this.toolCache.set(toolId, capability);
    return capability;
  }

  getAllAvailableTools(): string[] {
    return SCOUT_TOOLS.filter(tool => this.checkToolCapability(tool.id).isAvailable).map(
      t => t.id
    );
  }

  validateToolCall(toolId: string, params: Record<string, any>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check tool availability
    const capability = this.checkToolCapability(toolId);
    if (!capability.isAvailable) {
      return {
        valid: false,
        errors: [`Tool not available: ${capability.reason}`],
        warnings: [],
      };
    }

    // Get tool definition for schema validation
    const tool = getToolById(toolId);
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool definition not found: ${toolId}`],
        warnings: [],
      };
    }

    // Runtime parameter validation
    if (tool.inputSchema) {
      const schema = tool.inputSchema;
      
      // Check required parameters
      if (schema.required && Array.isArray(schema.required)) {
        for (const requiredParam of schema.required) {
          if (params[requiredParam] === undefined || params[requiredParam] === null) {
            errors.push(`Missing required parameter: ${requiredParam}`);
          }
        }
      }

      // Validate parameter types
      if (schema.properties) {
        for (const [paramName, paramValue] of Object.entries(params)) {
          const propSchema = schema.properties[paramName];
          
          if (!propSchema) {
            warnings.push(`Unknown parameter: ${paramName}`);
            continue;
          }

          // Type validation
          const expectedType = propSchema.type;
          const actualType = Array.isArray(paramValue) ? 'array' : typeof paramValue;
          
          if (expectedType && expectedType !== actualType) {
            // Allow null for optional params
            if (paramValue !== null || schema.required?.includes(paramName)) {
              errors.push(`Parameter '${paramName}' has wrong type: expected ${expectedType}, got ${actualType}`);
            }
          }

          // String length validation
          if (expectedType === 'string' && typeof paramValue === 'string') {
            if (propSchema.maxLength && paramValue.length > propSchema.maxLength) {
              errors.push(`Parameter '${paramName}' exceeds max length: ${paramValue.length} > ${propSchema.maxLength}`);
            }
            if (propSchema.minLength && paramValue.length < propSchema.minLength) {
              errors.push(`Parameter '${paramName}' below min length: ${paramValue.length} < ${propSchema.minLength}`);
            }
          }

          // Number range validation
          if (expectedType === 'number' && typeof paramValue === 'number') {
            if (propSchema.maximum !== undefined && paramValue > propSchema.maximum) {
              errors.push(`Parameter '${paramName}' exceeds maximum: ${paramValue} > ${propSchema.maximum}`);
            }
            if (propSchema.minimum !== undefined && paramValue < propSchema.minimum) {
              errors.push(`Parameter '${paramName}' below minimum: ${paramValue} < ${propSchema.minimum}`);
            }
          }

          // Enum validation
          if (propSchema.enum && !propSchema.enum.includes(paramValue)) {
            errors.push(`Parameter '${paramName}' must be one of: ${propSchema.enum.join(', ')}`);
          }
        }
      }
    }

    // Also call the original validation from config
    const configValidation = validateToolCall(toolId, params);
    if (!configValidation.valid) {
      errors.push(...configValidation.errors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate and execute tool with proper error handling
   */
  async validateAndExecute<T>(
    toolId: string,
    params: Record<string, any>,
    executor: (params: Record<string, any>) => Promise<T>
  ): Promise<{
    success: boolean;
    result?: T;
    error?: string;
    validationErrors?: string[];
    executionTimeMs: number;
  }> {
    const startTime = Date.now();
    
    // Validate parameters first
    const validation = this.validateToolCall(toolId, params);
    if (!validation.valid) {
      this.recordToolCall(toolId, params, 'failed', validation.errors.join('; '));
      return {
        success: false,
        error: 'Validation failed',
        validationErrors: validation.errors,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Log warnings but continue
    if (validation.warnings.length > 0) {
      console.warn(`[SCOUT-TOOLS] Warnings for ${toolId}:`, validation.warnings);
    }

    try {
      const result = await executor(params);
      const executionTimeMs = Date.now() - startTime;
      
      this.recordToolCall(toolId, params, 'success', undefined, result, executionTimeMs);
      
      return {
        success: true,
        result,
        executionTimeMs,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown execution error';
      
      this.recordToolCall(toolId, params, 'failed', errorMessage, undefined, executionTimeMs);
      
      return {
        success: false,
        error: errorMessage,
        executionTimeMs,
      };
    }
  }

  recordToolCall(
    toolId: string,
    params: Record<string, any>,
    status: 'success' | 'failed' | 'pending' = 'pending',
    error?: string,
    result?: any,
    executionTimeMs?: number
  ): void {
    const attempt: ToolCallAttempt = {
      toolId,
      params,
      timestamp: new Date(),
      status,
      error,
      result,
      executionTimeMs,
    };

    this.callHistory.push(attempt);

    // Keep history limited to last 1000 calls
    if (this.callHistory.length > 1000) {
      this.callHistory = this.callHistory.slice(-1000);
    }

    if (status === 'failed') {
      console.error(
        `[SCOUT-TOOLS] Tool call failed: ${toolId}`,
        error || 'Unknown error'
      );
    }
  }

  getCallHistory(toolId?: string, limit: number = 100): ToolCallAttempt[] {
    let history = this.callHistory;
    if (toolId) {
      history = history.filter(h => h.toolId === toolId);
    }
    return history.slice(-limit);
  }

  getToolStats(toolId: string): {
    totalCalls: number;
    successCount: number;
    failureCount: number;
    averageExecutionTimeMs: number;
  } {
    const calls = this.callHistory.filter(h => h.toolId === toolId);
    const successful = calls.filter(c => c.status === 'success');
    const failed = calls.filter(c => c.status === 'failed');

    const avgExecutionTime =
      successful.length > 0
        ? successful.reduce((sum, c) => sum + (c.executionTimeMs || 0), 0) / successful.length
        : 0;

    return {
      totalCalls: calls.length,
      successCount: successful.length,
      failureCount: failed.length,
      averageExecutionTimeMs: avgExecutionTime,
    };
  }

  getGlobalStats(): {
    totalToolsCalls: number;
    availableTools: number;
    totalTools: number;
    successRate: number;
  } {
    const totalCalls = this.callHistory.length;
    const successfulCalls = this.callHistory.filter(c => c.status === 'success').length;

    return {
      totalToolsCalls: totalCalls,
      availableTools: this.getAllAvailableTools().length,
      totalTools: SCOUT_TOOLS.length,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
    };
  }

  clearHistory(): void {
    this.callHistory = [];
    console.log('[SCOUT-TOOLS] Call history cleared');
  }

  invalidateCache(): void {
    this.toolCache.clear();
    this.validateToolAvailability();
    console.log('[SCOUT-TOOLS] Cache invalidated');
  }
}

export const scoutToolRegistry = new ScoutToolRegistry();

/**
 * Export tool registry for use in agent workflow
 */
export function initializeScoutTools(): {
  allTools: typeof SCOUT_TOOLS;
  availableTools: string[];
  registry: typeof scoutToolRegistry;
} {
  return {
    allTools: SCOUT_TOOLS,
    availableTools: scoutToolRegistry.getAllAvailableTools(),
    registry: scoutToolRegistry,
  };
}

export function getScoutCapabilities(): {
  aiServices: typeof SCOUT_AI_SERVICES;
  tools: typeof SCOUT_TOOLS;
  registry: typeof scoutToolRegistry;
} {
  return {
    aiServices: SCOUT_AI_SERVICES,
    tools: SCOUT_TOOLS,
    registry: scoutToolRegistry,
  };
}
