/**
 * Gap #15: Adaptive Parallelization Based on Dependencies
 * Build DAG (directed acyclic graph) of tool dependencies
 * Execute independent tools in parallel, respect sequential dependencies
 */

export interface ToolNode {
  id: string;
  name: string;
  duration?: number; // ms
  dependencies: string[]; // IDs of tools that must run first
}

export interface ExecutionSchedule {
  batches: ToolNode[][]; // Each batch runs in parallel
  criticalPath: string[]; // Longest path through DAG
  estimatedTime: number; // ms
}

/**
 * Build DAG from tool list
 */
export function buildDependencyDAG(tools: ToolNode[]): ExecutionSchedule {
  // Topological sort using Kahn's algorithm
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();
  const toolMap = new Map<string, ToolNode>();

  // Initialize
  for (const tool of tools) {
    toolMap.set(tool.id, tool);
    inDegree.set(tool.id, tool.dependencies.length);

    if (!adjacencyList.has(tool.id)) {
      adjacencyList.set(tool.id, []);
    }

    for (const dep of tool.dependencies) {
      if (!adjacencyList.has(dep)) {
        adjacencyList.set(dep, []);
      }
      adjacencyList.get(dep)!.push(tool.id);
    }
  }

  // Topological sort with level grouping
  const batches: ToolNode[][] = [];
  const queue: string[] = [];

  // Find nodes with no dependencies
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    // Current batch: all nodes with no remaining dependencies
    const batch = queue.splice(0, queue.length).map((id) => toolMap.get(id)!);
    if (batch.length > 0) {
      batches.push(batch);
    }

    // Process next level
    const nextQueue: string[] = [];
    for (const batch_tool of batch) {
      for (const neighbor of adjacencyList.get(batch_tool.id) || []) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
        if (inDegree.get(neighbor) === 0) {
          nextQueue.push(neighbor);
        }
      }
    }
    queue.push(...nextQueue);
  }

  // Calculate critical path
  const criticalPath = calculateCriticalPath(batches, toolMap);

  // Estimate time
  const estimatedTime = batches.reduce((sum, batch) => {
    const maxBatchTime = Math.max(...batch.map((t) => t.duration || 100));
    return sum + maxBatchTime;
  }, 0);

  return {
    batches,
    criticalPath,
    estimatedTime,
  };
}

function calculateCriticalPath(batches: ToolNode[][], toolMap: Map<string, ToolNode>): string[] {
  if (batches.length === 0) return [];

  // Simple approach: find longest path
  let longestPath: string[] = [];

  for (const tool of batches[batches.length - 1]) {
    const path = [tool.id];
    longestPath = path.length > longestPath.length ? path : longestPath;
  }

  return longestPath;
}

/**
 * Execute tools respecting DAG
 */
export async function executeWithDAG(
  tools: ToolNode[],
  executor: (toolId: string) => Promise<any>,
): Promise<Map<string, any>> {
  const schedule = buildDependencyDAG(tools);
  const results = new Map<string, any>();

  console.log(
    `[DAG] Executing ${tools.length} tools in ${schedule.batches.length} batches`,
  );
  console.log(`[DAG] Estimated time: ${schedule.estimatedTime}ms`);

  for (let batchIdx = 0; batchIdx < schedule.batches.length; batchIdx++) {
    const batch = schedule.batches[batchIdx];
    console.log(`[DAG] Batch ${batchIdx + 1}: ${batch.map((t) => t.name).join(', ')}`);

    // Execute all tools in batch in parallel
    const batchPromises = batch.map(async (tool) => {
      const startTime = Date.now();
      try {
        const result = await executor(tool.id);
        results.set(tool.id, result);
        console.log(
          `[DAG] ✓ ${tool.name} completed in ${Date.now() - startTime}ms`,
        );
      } catch (error) {
        console.error(`[DAG] ✗ ${tool.name} failed:`, error);
        throw error;
      }
    });

    // Wait for batch to complete
    await Promise.all(batchPromises);
  }

  return results;
}
