/**
 * GAP 3: UNIFIED TRACE LOGGING
 * Centralized trace logging service for debugging AI agent conversations
 */

import { nanoid } from 'nanoid';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface TraceEvent {
  traceId: string;
  timestamp: number;
  phase: 'prompt' | 'thought' | 'tool_call' | 'tool_result' | 'response' | 'error';
  data: any;
}

class TraceLogger {
  private traces: Map<string, TraceEvent[]> = new Map();
  private readonly MAX_TRACE_EVENTS = 1000; // Prevent memory leaks
  private readonly TRACE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Start a new trace session
   */
  startTrace(conversationId: string): string {
    const traceId = `trace_${nanoid()}`;
    this.traces.set(traceId, []);
    console.log(`[TRACE-LOGGER] Started trace ${traceId} for conversation ${conversationId}`);
    return traceId;
  }

  /**
   * Log a trace event
   */
  log(traceId: string, phase: TraceEvent['phase'], data: any) {
    const trace = this.traces.get(traceId);
    if (!trace) {
      console.warn(`[TRACE-LOGGER] No trace found for ID: ${traceId}`);
      return;
    }

    // Prevent memory overflow
    if (trace.length >= this.MAX_TRACE_EVENTS) {
      console.warn(`[TRACE-LOGGER] Trace ${traceId} exceeded max events, dropping oldest`);
      trace.shift();
    }

    const event: TraceEvent = {
      traceId,
      timestamp: Date.now(),
      phase,
      data: this.sanitizeData(data),
    };

    trace.push(event);
    this.traces.set(traceId, trace);

    // Log important events to console
    if (phase === 'error') {
      console.error(`[TRACE-${traceId}] Error:`, data);
    } else if (phase === 'tool_call') {
      console.log(`[TRACE-${traceId}] Tool: ${data?.name || 'unknown'}`);
    }
  }

  /**
   * Get all events for a trace
   */
  getTrace(traceId: string): TraceEvent[] {
    return this.traces.get(traceId) || [];
  }

  /**
   * Get trace summary (useful for debugging)
   */
  getTraceSummary(traceId: string): any {
    const events = this.getTrace(traceId);
    if (events.length === 0) return null;

    const toolCalls = events.filter(e => e.phase === 'tool_call');
    const errors = events.filter(e => e.phase === 'error');
    const duration = events.length > 0 
      ? events[events.length - 1].timestamp - events[0].timestamp
      : 0;

    return {
      traceId,
      totalEvents: events.length,
      toolCallCount: toolCalls.length,
      errorCount: errors.length,
      duration,
      startTime: events[0]?.timestamp,
      endTime: events[events.length - 1]?.timestamp,
      tools: toolCalls.map(e => e.data?.name || 'unknown'),
    };
  }

  /**
   * Persist trace to database for post-mortem analysis
   */
  async persist(traceId: string, conversationId: string, userId: string) {
    try {
      const events = this.getTrace(traceId);
      if (events.length === 0) {
        console.warn(`[TRACE-LOGGER] No events to persist for trace ${traceId}`);
        return;
      }

      const summary = this.getTraceSummary(traceId);

      // Store in database (using raw SQL for flexibility)
      await db.execute(sql`
        INSERT INTO trace_logs (
          trace_id,
          conversation_id,
          user_id,
          events,
          summary,
          created_at
        ) VALUES (
          ${traceId},
          ${conversationId},
          ${userId},
          ${JSON.stringify(events)}::jsonb,
          ${JSON.stringify(summary)}::jsonb,
          NOW()
        )
        ON CONFLICT (trace_id) DO UPDATE SET
          events = EXCLUDED.events,
          summary = EXCLUDED.summary,
          updated_at = NOW()
      `);

      console.log(`[TRACE-LOGGER] Persisted ${events.length} events for trace ${traceId}`);
    } catch (error: any) {
      console.error(`[TRACE-LOGGER] Failed to persist trace ${traceId}:`, error.message);
      // Don't throw - tracing should never break the main flow
    }
  }

  /**
   * Clean up old traces to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [traceId, events] of Array.from(this.traces.entries())) {
      if (events.length === 0) {
        this.traces.delete(traceId);
        cleaned++;
        continue;
      }

      const lastEvent = events[events.length - 1];
      if (now - lastEvent.timestamp > this.TRACE_TTL) {
        this.traces.delete(traceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TRACE-LOGGER] Cleaned up ${cleaned} old traces`);
    }
  }

  /**
   * Sanitize sensitive data before logging
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };

    // Remove sensitive fields
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'credential'];
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    // Truncate large strings
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 10000) {
        sanitized[key] = sanitized[key].substring(0, 10000) + '... [truncated]';
      }
    }

    return sanitized;
  }
}

// Singleton instance
export const traceLogger = new TraceLogger();

// Run cleanup every hour
setInterval(() => {
  traceLogger.cleanup();
}, 60 * 60 * 1000);
