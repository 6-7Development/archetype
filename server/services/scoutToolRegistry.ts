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
  } {
    const capability = this.checkToolCapability(toolId);
    if (!capability.isAvailable) {
      return {
        valid: false,
        errors: [`Tool not available: ${capability.reason}`],
      };
    }

    return validateToolCall(toolId, params);
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
