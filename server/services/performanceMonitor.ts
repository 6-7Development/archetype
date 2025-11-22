/**
 * Performance monitoring system for LomuAI
 * Tracks response times, token usage, error rates, and streaming performance
 * Exposes metrics via /api/metrics endpoint for dashboard consumption
 */

interface PerformanceMetric {
  timestamp: number;
  duration: number;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  error?: string;
  intent?: string;
  toolsUsed?: string[];
  streamingSpeed?: number; // chars/second
}

interface AggregatedMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  averageTokensPerRequest: number;
  averageStreamingSpeed: number;
  errorRate: number;
  errorCounts: Record<string, number>;
  intentDistribution: Record<string, number>;
  last24hMetrics: PerformanceMetric[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 10000; // Keep last 10k metrics in memory

  /**
   * Record a new performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep memory bounded
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Get metrics for the last N hours
   */
  getMetricsForPeriod(hoursBack: number = 24): PerformanceMetric[] {
    const cutoffTime = Date.now() - hoursBack * 3600 * 1000;
    return this.metrics.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * Get aggregated metrics summary
   */
  getAggregatedMetrics(hoursBack: number = 24): AggregatedMetrics {
    const recentMetrics = this.getMetricsForPeriod(hoursBack);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageResponseTime: 0,
        averageTokensPerRequest: 0,
        averageStreamingSpeed: 0,
        errorRate: 0,
        errorCounts: {},
        intentDistribution: {},
        last24hMetrics: [],
      };
    }

    const successCount = recentMetrics.filter(m => m.success).length;
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const totalTokens = recentMetrics.reduce((sum, m) => sum + m.tokensUsed, 0);
    const validStreamingSpeeds = recentMetrics
      .filter(m => m.streamingSpeed && m.streamingSpeed > 0)
      .map(m => m.streamingSpeed || 0);

    // Error distribution
    const errorCounts: Record<string, number> = {};
    recentMetrics.filter(m => !m.success && m.error).forEach(m => {
      errorCounts[m.error || 'unknown']++;
    });

    // Intent distribution
    const intentDistribution: Record<string, number> = {};
    recentMetrics.forEach(m => {
      if (m.intent) {
        intentDistribution[m.intent] = (intentDistribution[m.intent] || 0) + 1;
      }
    });

    return {
      totalRequests: recentMetrics.length,
      successRate: successCount / recentMetrics.length,
      averageResponseTime: totalDuration / recentMetrics.length,
      averageTokensPerRequest: totalTokens / recentMetrics.length,
      averageStreamingSpeed:
        validStreamingSpeeds.length > 0
          ? validStreamingSpeeds.reduce((a, b) => a + b) / validStreamingSpeeds.length
          : 0,
      errorRate: (recentMetrics.length - successCount) / recentMetrics.length,
      errorCounts,
      intentDistribution,
      last24hMetrics: recentMetrics,
    };
  }

  /**
   * Get performance alerts (warnings about degradation)
   */
  getPerformanceAlerts(): string[] {
    const alerts: string[] = [];
    const metrics = this.getAggregatedMetrics(1); // Last hour

    if (metrics.errorRate > 0.1) {
      alerts.push(`⚠️ High error rate: ${(metrics.errorRate * 100).toFixed(1)}% errors in last hour`);
    }

    if (metrics.averageResponseTime > 60000) {
      alerts.push(`⚠️ Slow responses: Average ${(metrics.averageResponseTime / 1000).toFixed(1)}s`);
    }

    if (metrics.averageTokensPerRequest > 100000) {
      alerts.push(`⚠️ High token usage: Average ${metrics.averageTokensPerRequest.toFixed(0)} tokens/request`);
    }

    return alerts;
  }

  /**
   * Clear old metrics to free memory
   */
  clearOldMetrics(olderThanHours: number = 72): number {
    const beforeCount = this.metrics.length;
    const cutoffTime = Date.now() - olderThanHours * 3600 * 1000;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
    const removed = beforeCount - this.metrics.length;

    if (removed > 0) {
      console.log(`[PERFORMANCE-MONITOR] Cleaned up ${removed} old metrics`);
    }

    return removed;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Auto-cleanup old metrics every hour
setInterval(() => {
  performanceMonitor.clearOldMetrics(72);
}, 3600000);

export type { PerformanceMetric, AggregatedMetrics };
