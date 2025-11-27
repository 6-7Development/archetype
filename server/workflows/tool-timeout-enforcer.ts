/**
 * TOOL TIMEOUT ENFORCER - GAP #1 FIX
 * Wraps tool execution with AbortController for hard timeout enforcement
 * Prevents hung tools from blocking entire workflow
 */

export class ToolTimeoutEnforcer {
  private static readonly DEFAULT_TIMEOUT = 5000; // 5 seconds per tool
  
  /**
   * Execute tool with strict timeout enforcement
   * @param toolName - Tool identifier
   * @param executor - Async function that executes the tool
   * @param timeoutMs - Timeout in milliseconds (default: 5000)
   * @returns Result or timeout error
   */
  static async executeWithTimeout<T>(
    toolName: string,
    executor: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number = this.DEFAULT_TIMEOUT
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      console.log(`⏱️ [TOOL-TIMEOUT] Starting ${toolName} with ${timeoutMs}ms timeout`);
      const result = await executor(controller.signal);
      clearTimeout(timeoutId);
      console.log(`✅ [TOOL-TIMEOUT] ${toolName} completed within timeout`);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error(`⏰ [TOOL-TIMEOUT] ${toolName} EXCEEDED ${timeoutMs}ms timeout - TERMINATED`);
        throw new Error(`Tool timeout: ${toolName} exceeded ${timeoutMs}ms limit and was aborted`);
      }
      
      throw error;
    }
  }

  /**
   * Execute multiple tools in series with timeout
   */
  static async executeSeriesWithTimeout<T>(
    tools: Array<{ name: string; executor: (signal: AbortSignal) => Promise<T> }>,
    timeoutMs: number = this.DEFAULT_TIMEOUT
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (const tool of tools) {
      const result = await this.executeWithTimeout(tool.name, tool.executor, timeoutMs);
      results.push(result);
    }
    
    return results;
  }
}
