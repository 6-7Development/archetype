/**
 * Memory Monitoring Middleware
 * 
 * Monitors memory usage and triggers garbage collection when approaching limits.
 * Critical for Railway's 512MB container limit to prevent OOM crashes.
 */

import { RAILWAY_CONFIG } from '../config/railway.ts';

let monitoringInterval: NodeJS.Timeout | null = null;
let lastGCTime = 0;
const GC_COOLDOWN = 60000; // 1 minute cooldown between forced GC

/**
 * Setup memory monitoring for production environments
 * Runs periodic checks and forces GC when memory is high
 */
export function setupMemoryMonitoring(): void {
  // Only monitor in production/Railway environments
  if (!RAILWAY_CONFIG.IS_PRODUCTION && !RAILWAY_CONFIG.IS_RAILWAY) {
    console.log('[MEMORY-MONITOR] Skipped - not in production');
    return;
  }

  console.log('[MEMORY-MONITOR] Starting memory monitoring');
  console.log(`[MEMORY-MONITOR] Warning threshold: ${RAILWAY_CONFIG.MEMORY_WARNING_THRESHOLD}MB`);
  console.log(`[MEMORY-MONITOR] Container limit: ${RAILWAY_CONFIG.MEMORY_LIMIT_MB}MB`);

  // Clear any existing monitor
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  monitoringInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(usage.rss / 1024 / 1024);
    const percentage = Math.round((totalMB / RAILWAY_CONFIG.MEMORY_LIMIT_MB) * 100);

    // Log memory stats every interval
    console.log(`[MEMORY] Heap: ${usedMB}MB | RSS: ${totalMB}MB | Usage: ${percentage}%`);

    // Warning threshold - approaching limit
    if (usedMB > RAILWAY_CONFIG.MEMORY_WARNING_THRESHOLD) {
      console.warn(`[MEMORY] ⚠️ High memory usage: ${usedMB}MB / ${RAILWAY_CONFIG.MEMORY_LIMIT_MB}MB (${percentage}%)`);

      // Force garbage collection if available and cooldown passed
      const now = Date.now();
      if (global.gc && (now - lastGCTime) > GC_COOLDOWN) {
        const beforeGC = usedMB;
        global.gc();
        lastGCTime = now;
        
        // Measure GC impact
        const afterUsage = process.memoryUsage();
        const afterMB = Math.round(afterUsage.heapUsed / 1024 / 1024);
        const freed = beforeGC - afterMB;
        
        console.log(`[MEMORY] Forced garbage collection - freed ${freed}MB (${beforeGC}MB → ${afterMB}MB)`);
      } else if (!global.gc) {
        console.warn('[MEMORY] Garbage collection not available (run with --expose-gc flag)');
      }
    }

    // Critical threshold - very close to limit
    if (percentage >= 90) {
      console.error(`[MEMORY] 🚨 CRITICAL: ${percentage}% memory usage - container may crash soon!`);
    }

  }, RAILWAY_CONFIG.HEALTH_CHECK_INTERVAL);

  console.log(`[MEMORY-MONITOR] Active - checking every ${RAILWAY_CONFIG.HEALTH_CHECK_INTERVAL / 1000}s`);
}

/**
 * Stop memory monitoring (for graceful shutdown)
 */
export function stopMemoryMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('[MEMORY-MONITOR] Stopped');
  }
}

/**
 * Get current memory usage snapshot
 */
export function getMemorySnapshot() {
  const usage = process.memoryUsage();
  return {
    heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
    rssMB: Math.round(usage.rss / 1024 / 1024),
    externalMB: Math.round(usage.external / 1024 / 1024),
    percentage: Math.round((usage.rss / (RAILWAY_CONFIG.MEMORY_LIMIT_MB * 1024 * 1024)) * 100),
  };
}
