/**
 * PROGRESS TRACKER - TIER 2 GAP #1 FIX
 * SSE-based real-time progress streaming for browser
 * Sends progress events: thinking, action, result, phase-change
 */

interface ProgressEvent {
  type: 'thinking' | 'action' | 'result' | 'phase' | 'error' | 'complete';
  message: string;
  timestamp: number;
  phase?: string;
  toolName?: string;
  percent?: number;
  duration?: number;
}

export class ProgressTracker {
  private static eventListeners: Set<(event: ProgressEvent) => void> = new Set();
  private static events: ProgressEvent[] = [];
  private static readonly MAX_EVENTS = 100;
  private static heartbeatInterval: NodeJS.Timeout | null = null;
  private static readonly HEARTBEAT_INTERVAL_MS = 10000; // 10 seconds

  /**
   * Start SSE heartbeat mechanism (GAP #4 FIX)
   * Prevents silent connection failures by sending periodic pings
   */
  static startHeartbeat(): void {
    if (this.heartbeatInterval) return; // Already running

    this.heartbeatInterval = setInterval(() => {
      this.broadcastProgress({
        type: 'thinking',
        message: 'heartbeat',
      });
    }, this.HEARTBEAT_INTERVAL_MS);

    console.log('[PROGRESS-TRACKER] Heartbeat started (10s interval)');
  }

  /**
   * Stop SSE heartbeat
   */
  static stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[PROGRESS-TRACKER] Heartbeat stopped');
    }
  }

  /**
   * Broadcast progress event to all listeners
   */
  static broadcastProgress(event: Omit<ProgressEvent, 'timestamp'>): void {
    const fullEvent: ProgressEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }

    // Log to console
    console.log(`📊 [PROGRESS-${event.type.toUpperCase()}] ${event.message}`);

    // Broadcast to all listeners
    this.eventListeners.forEach((listener) => {
      try {
        listener(fullEvent);
      } catch (error) {
        console.error('[PROGRESS-TRACKER] Listener error:', error);
      }
    });
  }

  /**
   * Subscribe to progress events
   */
  static subscribe(listener: (event: ProgressEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Get recent progress events
   */
  static getRecent(limit: number = 20): ProgressEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Clear all progress events
   */
  static clear(): void {
    this.events = [];
  }

  /**
   * Send SSE event to response object
   */
  static sendSSE(res: any, event: ProgressEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  /**
   * Thinking event
   */
  static thinking(message: string): void {
    this.broadcastProgress({
      type: 'thinking',
      message,
    });
  }

  /**
   * Action/tool execution event
   */
  static action(message: string, toolName?: string): void {
    this.broadcastProgress({
      type: 'action',
      message,
      toolName,
    });
  }

  /**
   * Result event
   */
  static result(message: string, duration?: number): void {
    this.broadcastProgress({
      type: 'result',
      message,
      duration,
    });
  }

  /**
   * Phase change event
   */
  static phase(phase: string, message: string, percent?: number): void {
    this.broadcastProgress({
      type: 'phase',
      message,
      phase,
      percent,
    });
  }

  /**
   * Error event
   */
  static error(message: string): void {
    this.broadcastProgress({
      type: 'error',
      message,
    });
  }

  /**
   * Completion event
   */
  static complete(message: string): void {
    this.broadcastProgress({
      type: 'complete',
      message,
    });
  }
}
