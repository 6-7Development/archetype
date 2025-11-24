/**
 * TOOL ORCHESTRATOR - Intelligent tool execution with dependency checking, safe mode, and profiling
 * Ensures tools run in correct order, handles failures gracefully, and profiles performance
 */

import { aiDecisionLogger } from './aiDecisionLogger';
import { toolResponseValidator } from './toolResponseValidator';
import { guardrails } from './guardrailsManager';

// ==================== INTERFACES ====================

export interface ToolDefinition {
  name: string;
  description: string;
  dependencies: string[]; // Tools that must run before this one
  critical: boolean; // If true, failure stops execution
  timeout: number; // ms
  maxRetries: number;
  costEstimate: number; // in cents
}

export interface ToolExecution {
  tool: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  result?: any;
  error?: string;
  retries: number;
  duration?: number;
  costActual?: number;
}

export interface ExecutionPlan {
  tools: ToolDefinition[];
  order: string[];
  estimatedCost: number;
  estimatedDuration: number;
  parallelGroups: string[][];
}

export interface SafeModeOptions {
  enabled: boolean;
  autoRollback: boolean;
  maxFailures: number;
  failoverStrategy: 'abort' | 'skip' | 'retry';
}

// ==================== TOOL ORCHESTRATOR ====================

export class ToolOrchestrator {
  private tools: Map<string, ToolDefinition> = new Map();
  private executions: ToolExecution[] = [];
  private safeMode: SafeModeOptions = {
    enabled: true,
    autoRollback: true,
    maxFailures: 3,
    failoverStrategy: 'retry',
  };
  private performanceProfile: Map<string, { durations: number[]; failures: number }> = new Map();

  /**
   * Register a tool with dependencies
   */
  registerTool(definition: ToolDefinition): void {
    this.tools.set(definition.name, definition);
  }

  /**
   * Plan tool execution order based on dependencies
   */
  planExecution(requestedTools: string[]): { plan: ExecutionPlan; valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const order: string[] = [];
    const visited = new Set<string>();
    const parallelGroups: string[][] = [];

    // Topological sort with cycle detection
    const visit = (toolName: string, visiting = new Set<string>()): boolean => {
      if (visited.has(toolName)) return true;
      if (visiting.has(toolName)) {
        issues.push(`Circular dependency detected: ${toolName}`);
        return false;
      }

      const tool = this.tools.get(toolName);
      if (!tool) {
        issues.push(`Tool not registered: ${toolName}`);
        return false;
      }

      visiting.add(toolName);

      // Visit dependencies first
      for (const dep of tool.dependencies) {
        if (!visit(dep, visiting)) return false;
      }

      visiting.delete(toolName);
      visited.add(toolName);
      order.push(toolName);
      return true;
    };

    // Sort all requested tools
    for (const tool of requestedTools) {
      if (!visit(tool)) {
        return { plan: {} as ExecutionPlan, valid: false, issues };
      }
    }

    // Group tools that can run in parallel
    this.groupParallelTools(order, parallelGroups);

    // Calculate estimates
    let estimatedCost = 0;
    let estimatedDuration = 0;

    for (const tool of order) {
      const def = this.tools.get(tool)!;
      estimatedCost += def.costEstimate;
      estimatedDuration += def.timeout;
    }

    const plan: ExecutionPlan = {
      tools: order.map((t) => this.tools.get(t)!),
      order,
      estimatedCost,
      estimatedDuration,
      parallelGroups,
    };

    return { plan, valid: issues.length === 0, issues };
  }

  /**
   * Execute tools according to plan with safe mode
   */
  async executePlan(
    plan: ExecutionPlan,
    toolExecutors: Map<string, (params: any) => Promise<any>>,
    userId: string,
    sessionId: string,
    params: Record<string, any> = {}
  ): Promise<{
    success: boolean;
    results: Map<string, ToolExecution>;
    failures: string[];
  }> {
    const results = new Map<string, ToolExecution>();
    const failures: string[] = [];
    let failureCount = 0;

    await aiDecisionLogger.logDecision({
      userId,
      sessionId,
      agent: 'sub-agent',
      action: 'task-start',
      description: `Executing ${plan.order.length} tools in ${plan.parallelGroups.length} parallel groups`,
      tools: plan.order,
      costEstimate: plan.estimatedCost,
      success: true,
      reason: 'Tool execution plan started',
    });

    // Execute parallel groups
    for (const group of plan.parallelGroups) {
      if (this.safeMode.enabled && failureCount >= this.safeMode.maxFailures) {
        const msg = `Max failures (${this.safeMode.maxFailures}) reached, aborting execution`;
        failures.push(msg);

        await aiDecisionLogger.logDecision({
          userId,
          sessionId,
          agent: 'sub-agent',
          action: 'error',
          description: msg,
          success: false,
          reason: 'Max failures exceeded',
        });

        if (this.safeMode.failoverStrategy === 'abort') break;
      }

      // Execute tools in parallel within group
      const groupPromises = group.map((tool) => this.executeTool(tool, toolExecutors, params, results, userId, sessionId));

      const groupResults = await Promise.allSettled(groupPromises);

      for (let i = 0; i < groupResults.length; i++) {
        const result = groupResults[i];
        const toolName = group[i];

        if (result.status === 'rejected') {
          failureCount++;
          failures.push(`${toolName}: ${result.reason}`);
          const execution = results.get(toolName);
          if (execution && this.tools.get(toolName)?.critical) {
            failures.push(`Critical tool ${toolName} failed`);
            if (this.safeMode.failoverStrategy === 'abort') break;
          }
        }
      }
    }

    const success = failures.length === 0;

    await aiDecisionLogger.logDecision({
      userId,
      sessionId,
      agent: 'sub-agent',
      action: 'completion',
      description: `Tool execution complete: ${results.size} succeeded, ${failures.length} failed`,
      tools: plan.order,
      success,
      reason: success ? 'All tools executed successfully' : `${failures.length} tool(s) failed`,
      metadata: { failureDetails: failures },
    });

    return { success, results, failures };
  }

  /**
   * Execute single tool with retry logic
   */
  private async executeTool(
    toolName: string,
    executors: Map<string, (params: any) => Promise<any>>,
    params: Record<string, any>,
    results: Map<string, ToolExecution>,
    userId: string,
    sessionId: string
  ): Promise<void> {
    const tool = this.tools.get(toolName)!;
    let execution: ToolExecution = {
      tool: toolName,
      startTime: Date.now(),
      success: false,
      retries: 0,
    };

    let lastError: Error | null = null;

    // Retry loop
    for (let attempt = 0; attempt <= tool.maxRetries; attempt++) {
      execution.retries = attempt;

      try {
        // Check rate limit
        const rateLimit = guardrails.checkRateLimit(userId);
        if (!rateLimit.allowed) {
          throw new Error(`Rate limit exceeded (${rateLimit.remaining} remaining)`);
        }

        // Get executor
        const executor = executors.get(toolName);
        if (!executor) {
          throw new Error(`No executor registered for tool: ${toolName}`);
        }

        // Execute with timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool timeout: ${tool.timeout}ms`)), tool.timeout)
        );

        const resultPromise = executor(params);
        const result = await Promise.race([resultPromise, timeoutPromise]);

        // Validate result
        const validation = toolResponseValidator.validate(toolName, result);
        toolResponseValidator.logToolCall(toolName, validation.success);

        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
        execution.success = validation.success;
        execution.result = validation.data;
        execution.error = validation.error;

        // Cost tracking
        execution.costActual = tool.costEstimate;
        const costCheck = guardrails.trackCost(userId, sessionId, execution.costActual);
        if (!costCheck.withinBudget) {
          throw new Error(`Cost limit exceeded ($${(costCheck.remaining / 100).toFixed(2)} remaining)`);
        }

        results.set(toolName, execution);

        // Update performance profile
        this.recordPerformance(toolName, execution.duration, true);

        await aiDecisionLogger.logDecision({
          userId,
          sessionId,
          agent: 'sub-agent',
          action: 'tool-call',
          description: `Tool executed: ${toolName}`,
          tools: [toolName],
          costActual: execution.costActual,
          duration: execution.duration,
          success: true,
        });

        return;
      } catch (error: any) {
        lastError = error;
        execution.error = error.message;
        this.recordPerformance(toolName, 0, false);

        if (attempt < tool.maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Final failure
    execution.endTime = Date.now();
    execution.duration = execution.endTime - execution.startTime;
    execution.success = false;
    results.set(toolName, execution);

    await aiDecisionLogger.logDecision({
      userId,
      sessionId,
      agent: 'sub-agent',
      action: 'error',
      description: `Tool failed after ${tool.maxRetries + 1} attempts: ${toolName}`,
      tools: [toolName],
      duration: execution.duration,
      success: false,
      reason: lastError?.message || 'Unknown error',
      metadata: { attempts: tool.maxRetries + 1, critical: tool.critical },
    });

    if (tool.critical && this.safeMode.autoRollback) {
      throw lastError;
    }
  }

  /**
   * Get tool performance profile
   */
  getPerformanceProfile(toolName: string): { avgDuration: number; failureRate: number; health: string } {
    const profile = this.performanceProfile.get(toolName);
    if (!profile || profile.durations.length === 0) {
      return { avgDuration: 0, failureRate: 0, health: 'unknown' };
    }

    const avgDuration = profile.durations.reduce((a, b) => a + b) / profile.durations.length;
    const totalRuns = profile.durations.length + profile.failures;
    const failureRate = profile.failures / totalRuns;

    let health = 'healthy';
    if (failureRate > 0.2) health = 'degraded';
    if (failureRate > 0.5) health = 'unhealthy';

    return { avgDuration, failureRate, health };
  }

  /**
   * Private: Group tools that can run in parallel
   */
  private groupParallelTools(order: string[], groups: string[][]): void {
    const grouped = new Set<string>();

    for (const tool of order) {
      if (grouped.has(tool)) continue;

      const group = [tool];
      grouped.add(tool);

      // Find other tools that don't depend on this one and don't have dependencies
      for (const other of order) {
        if (grouped.has(other)) continue;

        const def = this.tools.get(other)!;
        const noDeps = def.dependencies.length === 0 || def.dependencies.every((d) => grouped.has(d));

        if (noDeps) {
          group.push(other);
          grouped.add(other);
        }
      }

      groups.push(group);
    }
  }

  /**
   * Private: Record tool performance
   */
  private recordPerformance(toolName: string, duration: number, success: boolean): void {
    let profile = this.performanceProfile.get(toolName);
    if (!profile) {
      profile = { durations: [], failures: 0 };
      this.performanceProfile.set(toolName, profile);
    }

    if (success && duration > 0) {
      profile.durations.push(duration);
      if (profile.durations.length > 100) {
        profile.durations.shift(); // Keep only last 100
      }
    } else {
      profile.failures++;
    }
  }
}

// Export singleton
export const toolOrchestrator = new ToolOrchestrator();
