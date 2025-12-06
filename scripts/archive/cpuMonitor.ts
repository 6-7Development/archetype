/**
 * CPU Monitoring Service
 * Tracks CPU usage and prevents high CPU incidents
 */

import * as os from 'os';

interface CpuMetrics {
  usage: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  loadAverage: number[];
}

class CpuMonitorService {
  private metrics: CpuMetrics[] = [];
  private readonly MAX_METRICS = 100; // Keep last 100 measurements
  private readonly HIGH_CPU_THRESHOLD = 80; // 80% CPU usage alert
  private readonly MONITORING_INTERVAL = 10000; // Check every 10 seconds
  private monitoringTimer: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(metrics: CpuMetrics) => void> = [];

  /**
   * Start CPU monitoring
   */
  startMonitoring(): void {
    if (this.monitoringTimer) {
      console.log('[CPU-MONITOR] Already monitoring');
      return;
    }

    console.log('[CPU-MONITOR] Starting CPU monitoring');
    
    this.monitoringTimer = setInterval(() => {
      this.measureCpu();
    }, this.MONITORING_INTERVAL);

    // Take initial measurement
    this.measureCpu();
  }

  /**
   * Stop CPU monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
      console.log('[CPU-MONITOR] Stopped monitoring');
    }
  }

  /**
   * Measure current CPU usage
   */
  private measureCpu(): void {
    const startMeasure = process.cpuUsage();
    const startTime = process.hrtime();

    setTimeout(() => {
      const cpuUsage = process.cpuUsage(startMeasure);
      const diff = process.hrtime(startTime);
      const diffInNs = diff[0] * 1e9 + diff[1]; // Convert to nanoseconds
      
      // Calculate CPU usage percentage
      const totalCpuTime = (cpuUsage.user + cpuUsage.system) * 1000; // Convert to nanoseconds
      const usage = Math.round((totalCpuTime / diffInNs) * 100);

      const metrics: CpuMetrics = {
        usage: Math.min(usage, 100), // Cap at 100%
        timestamp: new Date(),
        memoryUsage: process.memoryUsage(),
        loadAverage: os.loadavg(),
      };

      this.recordMetrics(metrics);

      // Check for high CPU usage
      if (metrics.usage > this.HIGH_CPU_THRESHOLD) {
        console.warn('[CPU-MONITOR] High CPU usage detected:', metrics.usage + '%');
        this.triggerAlert(metrics);
      }

    }, 1000); // Measure over 1 second interval
  }

  /**
   * Record CPU metrics
   */
  private recordMetrics(metrics: CpuMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log periodically (every 5 minutes)
    if (this.metrics.length % 30 === 0) {
      const avgCpu = this.getAverageCpu(10);
      console.log('[CPU-MONITOR] Avg CPU (10min):', avgCpu.toFixed(1) + '%');
    }
  }

  /**
   * Trigger high CPU alert
   */
  private triggerAlert(metrics: CpuMetrics): void {
    // Call registered alert callbacks
    for (const callback of this.alertCallbacks) {
      try {
        callback(metrics);
      } catch (error) {
        console.error('[CPU-MONITOR] Alert callback failed:', error);
      }
    }
  }

  /**
   * Register callback for high CPU alerts
   */
  onHighCpu(callback: (metrics: CpuMetrics) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get current CPU usage
   */
  getCurrentCpu(): number {
    const latest = this.metrics[this.metrics.length - 1];
    return latest ? latest.usage : 0;
  }

  /**
   * Get average CPU usage over last N measurements
   */
  getAverageCpu(count: number = 10): number {
    if (this.metrics.length === 0) return 0;

    const recentMetrics = this.metrics.slice(-count);
    const sum = recentMetrics.reduce((acc, m) => acc + m.usage, 0);
    return sum / recentMetrics.length;
  }

  /**
   * Get CPU trend (increasing/decreasing)
   */
  getCpuTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.metrics.length < 5) return 'stable';

    const recent5 = this.metrics.slice(-5);
    const older5 = this.metrics.slice(-10, -5);

    if (older5.length === 0) return 'stable';

    const recentAvg = recent5.reduce((acc, m) => acc + m.usage, 0) / recent5.length;
    const olderAvg = older5.reduce((acc, m) => acc + m.usage, 0) / older5.length;

    const diff = recentAvg - olderAvg;
    
    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Get system health summary
   */
  getHealthSummary() {
    const current = this.getCurrentCpu();
    const average = this.getAverageCpu(10);
    const trend = this.getCpuTrend();
    const latest = this.metrics[this.metrics.length - 1];

    return {
      currentCpu: current,
      averageCpu: average,
      trend,
      memoryUsage: latest?.memoryUsage || process.memoryUsage(),
      loadAverage: latest?.loadAverage || os.loadavg(),
      status: current > this.HIGH_CPU_THRESHOLD ? 'critical' : 
              current > 60 ? 'warning' : 'healthy',
      timestamp: new Date(),
    };
  }

  /**
   * Get all recent metrics
   */
  getMetrics(count: number = 20): CpuMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = [];
    console.log('[CPU-MONITOR] Metrics reset');
  }
}

export const cpuMonitor = new CpuMonitorService();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  cpuMonitor.startMonitoring();

  // Register alert for high CPU
  cpuMonitor.onHighCpu((metrics) => {
    console.error('[CPU-ALERT] High CPU detected:', {
      usage: metrics.usage + '%',
      memory: Math.round(metrics.memoryUsage.used / 1024 / 1024) + 'MB',
      loadAvg: metrics.loadAverage.map(l => l.toFixed(2)).join(', '),
    });
  });
}