/**
 * Gap #11: Subagent Performance Tracking
 * Collects telemetry on subagent execution: speed, tokens, success rate
 * Enables optimization and comparison
 */

export interface SubagentMetrics {
  agentType: string;
  executionId: string;
  startTime: number;
  endTime: number;
  duration: number; // milliseconds
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokenEfficiency: number; // tokens per millisecond
  success: boolean;
  errorCount: number;
  filesModified: number;
  testsCovered?: number;
  timeoutOccurred: boolean;
}

export interface SubagentPerformanceStats {
  agentType: string;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  successRate: number; // percentage
  avgDuration: number; // ms
  minDuration: number;
  maxDuration: number;
  avgTokensPerRun: number;
  totalTokensConsumed: number;
  avgFilesModified: number;
  costEstimate: number; // in dollars
}

class SubagentPerformanceTracker {
  private metrics: Map<string, SubagentMetrics[]> = new Map();
  private stats: Map<string, SubagentPerformanceStats> = new Map();

  /**
   * Record a subagent execution
   */
  recordExecution(metrics: SubagentMetrics) {
    const key = metrics.agentType;

    // Store metrics
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metrics);

    // Update stats
    this.updateStats(key);

    // Log it
    this.logMetrics(metrics);
  }

  private updateStats(agentType: string) {
    const executions = this.metrics.get(agentType) || [];

    const successful = executions.filter((m) => m.success).length;
    const failed = executions.filter((m) => !m.success).length;

    const avgDuration =
      executions.reduce((sum, m) => sum + m.duration, 0) / executions.length || 0;
    const minDuration = Math.min(...executions.map((m) => m.duration));
    const maxDuration = Math.max(...executions.map((m) => m.duration));

    const totalTokens = executions.reduce((sum, m) => sum + m.totalTokens, 0);
    const avgTokens = totalTokens / executions.length || 0;

    const avgFiles =
      executions.reduce((sum, m) => sum + m.filesModified, 0) / executions.length || 0;

    // Cost estimate: Gemini ~$0.00075 per 1k tokens (input), ~$0.003 per 1k tokens (output)
    const costEstimate = (totalTokens / 1000000) * 0.75; // Rough estimate

    this.stats.set(agentType, {
      agentType,
      totalRuns: executions.length,
      successCount: successful,
      failureCount: failed,
      successRate: (successful / executions.length) * 100 || 0,
      avgDuration,
      minDuration,
      maxDuration,
      avgTokensPerRun: avgTokens,
      totalTokensConsumed: totalTokens,
      avgFilesModified: avgFiles,
      costEstimate,
    });
  }

  /**
   * Get stats for a specific agent
   */
  getStats(agentType: string): SubagentPerformanceStats | null {
    return this.stats.get(agentType) || null;
  }

  /**
   * Get all stats
   */
  getAllStats(): SubagentPerformanceStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Compare two agents
   */
  compare(agent1: string, agent2: string) {
    const stats1 = this.stats.get(agent1);
    const stats2 = this.stats.get(agent2);

    if (!stats1 || !stats2) {
      return null;
    }

    return {
      faster: stats1.avgDuration < stats2.avgDuration ? agent1 : agent2,
      speedDiff: Math.abs(stats1.avgDuration - stats2.avgDuration),
      moreReliable: stats1.successRate > stats2.successRate ? agent1 : agent2,
      reliabilityDiff: Math.abs(stats1.successRate - stats2.successRate),
      moreEfficient:
        stats1.avgTokensPerRun < stats2.avgTokensPerRun ? agent1 : agent2,
      efficiencyDiff: Math.abs(stats1.avgTokensPerRun - stats2.avgTokensPerRun),
    };
  }

  private logMetrics(metrics: SubagentMetrics) {
    console.log(`[SUBAGENT-PERF] ${metrics.agentType} (${metrics.executionId})`);
    console.log(
      `  Duration: ${metrics.duration}ms | Tokens: ${metrics.totalTokens} | Files: ${metrics.filesModified}`,
    );
    console.log(`  Success: ${metrics.success ? '✅' : '❌'} | Timeout: ${metrics.timeoutOccurred ? '⚠️' : '✓'}`);
    if (metrics.errorCount > 0) {
      console.log(`  Errors: ${metrics.errorCount}`);
    }
  }
}

// Singleton instance
export const performanceTracker = new SubagentPerformanceTracker();
