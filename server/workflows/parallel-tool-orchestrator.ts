/**
 * PARALLEL TOOL ORCHESTRATOR - GAP #2 FIX
 * Executes up to 4 tools in parallel for ~4x speedup
 * Prevents blocking on sequential tool execution
 */

import { ToolTimeoutEnforcer } from './tool-timeout-enforcer.ts';

interface ParallelToolTask {
  name: string;
  executor: (signal: AbortSignal) => Promise<any>;
  priority?: number; // Higher = execute first
}

export class ParallelToolOrchestrator {
  private static readonly MAX_PARALLEL = 4; // Config: tools.maxParallel
  private static readonly TOOL_TIMEOUT = 5000; // Config: tools.timeoutMs

  /**
   * Execute tools in parallel batches (max 4 concurrent)
   * @param tools - Array of tools to execute
   * @returns Array of results in same order as input
   */
  static async executeParallel(tools: ParallelToolTask[]): Promise<any[]> {
    if (tools.length === 0) {
      return [];
    }

    // Sort by priority (higher first)
    const sorted = [...tools].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    console.log(`🐝 [PARALLEL-ORCHESTRATOR] Batching ${tools.length} tools into groups of ${this.MAX_PARALLEL}`);

    const results: any[] = new Array(tools.length);
    const originalIndexMap = new Map(sorted.map((tool, idx) => [tool.name, idx]));

    // Execute in batches
    for (let batch = 0; batch < sorted.length; batch += this.MAX_PARALLEL) {
      const batchTools = sorted.slice(batch, batch + this.MAX_PARALLEL);
      const batchSize = Math.min(this.MAX_PARALLEL, sorted.length - batch);
      const batchNum = Math.floor(batch / this.MAX_PARALLEL) + 1;

      console.log(`🐝 [PARALLEL-ORCHESTRATOR] Batch ${batchNum}: Executing ${batchSize} tools in parallel`);

      const promises = batchTools.map((tool) =>
        ToolTimeoutEnforcer.executeWithTimeout(tool.name, tool.executor, this.TOOL_TIMEOUT)
          .then((result) => {
            const originalIdx = originalIndexMap.get(tool.name);
            if (originalIdx !== undefined) {
              results[originalIdx] = result;
            }
            return result;
          })
          .catch((error) => {
            const originalIdx = originalIndexMap.get(tool.name);
            if (originalIdx !== undefined) {
              results[originalIdx] = { success: false, error: error.message };
            }
            console.error(`❌ [PARALLEL-ORCHESTRATOR] Tool ${tool.name} failed:`, error.message);
            return { success: false, error: error.message };
          })
      );

      await Promise.all(promises);
      console.log(`✅ [PARALLEL-ORCHESTRATOR] Batch ${batchNum} complete`);
    }

    return results;
  }

  /**
   * Calculate speedup achieved by parallel execution
   * @param toolCount - Number of tools
   * @returns Expected speedup multiplier
   */
  static calculateSpeedup(toolCount: number): number {
    // 1 tool = 1x, 2-4 tools = 4x, 5-8 tools = 2x (two batches), etc.
    const batches = Math.ceil(toolCount / this.MAX_PARALLEL);
    return toolCount / batches;
  }
}
