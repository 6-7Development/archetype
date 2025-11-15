/**
 * HEALING TELEMETRY - Production-grade monitoring for JSON self-healing
 * 
 * Tracks success/failure rates of JSON healing operations to help optimize
 * the robustExtractAndHeal() function and identify patterns in failures.
 * 
 * Features:
 * - Real-time success/failure tracking
 * - Failure reason categorization
 * - Automatic stats logging every 5 minutes
 * - Reset capability for fresh monitoring periods
 */

class HealingTelemetry {
  private healingAttempts = 0;
  private healingSuccesses = 0;
  private healingFailures = 0;
  private failureReasons: Map<string, number> = new Map();
  private statsInterval: NodeJS.Timeout | null = null;
  
  /**
   * Record successful JSON healing operation
   * @param toolName - Name of the tool that was successfully healed
   */
  recordHealingSuccess(toolName: string) {
    this.healingAttempts++;
    this.healingSuccesses++;
    console.log(`[TELEMETRY] ✅ Healing success for tool: ${toolName} (Total: ${this.healingSuccesses}/${this.healingAttempts})`);
  }
  
  /**
   * Record failed JSON healing attempt
   * @param reason - Error message or reason for failure
   */
  recordHealingFailure(reason: string) {
    this.healingAttempts++;
    this.healingFailures++;
    
    // Categorize the failure reason (extract first 100 chars for grouping)
    const categorizedReason = reason.substring(0, 100);
    this.failureReasons.set(
      categorizedReason, 
      (this.failureReasons.get(categorizedReason) || 0) + 1
    );
    
    console.log(`[TELEMETRY] ❌ Healing failure: ${categorizedReason} (Total failures: ${this.healingFailures})`);
  }
  
  /**
   * Get current telemetry statistics
   * @returns Object with success rate, attempts, and failure breakdown
   */
  getStats() {
    return {
      totalAttempts: this.healingAttempts,
      successes: this.healingSuccesses,
      failures: this.healingFailures,
      successRate: this.healingAttempts > 0 
        ? (this.healingSuccesses / this.healingAttempts * 100).toFixed(2) + '%'
        : '0%',
      failureReasons: Object.fromEntries(this.failureReasons)
    };
  }
  
  /**
   * Log telemetry statistics to console
   * Only logs if there have been healing attempts
   */
  logStats() {
    if (this.healingAttempts === 0) {
      console.log('[TELEMETRY] No JSON healing attempts recorded yet');
      return;
    }
    
    const stats = this.getStats();
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 [TELEMETRY] JSON Healing Performance Statistics');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total Attempts:  ${stats.totalAttempts}`);
    console.log(`✅ Successes:    ${stats.successes}`);
    console.log(`❌ Failures:     ${stats.failures}`);
    console.log(`📈 Success Rate: ${stats.successRate}`);
    
    if (Object.keys(stats.failureReasons).length > 0) {
      console.log('\nFailure Breakdown:');
      Object.entries(stats.failureReasons).forEach(([reason, count]) => {
        console.log(`  - ${reason}: ${count} occurrence(s)`);
      });
    }
    console.log('═══════════════════════════════════════════════════\n');
  }
  
  /**
   * Reset all telemetry counters
   * Useful for starting fresh monitoring periods
   */
  resetStats() {
    console.log('[TELEMETRY] Resetting healing statistics...');
    this.healingAttempts = 0;
    this.healingSuccesses = 0;
    this.healingFailures = 0;
    this.failureReasons.clear();
  }
  
  /**
   * Start automatic stats logging every 5 minutes
   * Uses unref() to prevent keeping the process alive
   */
  startAutoLogging() {
    if (this.statsInterval) return;
    
    this.statsInterval = setInterval(() => this.logStats(), 5 * 60 * 1000);
    // Prevent interval from keeping process alive during tests
    this.statsInterval.unref();
    console.log('[TELEMETRY] Auto-logging started (5-minute intervals)');
  }
  
  /**
   * Stop automatic stats logging
   * Used for tests and graceful shutdown
   */
  stopAutoLogging() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      console.log('[TELEMETRY] Auto-logging stopped');
    }
  }
}

// Export singleton instance
export const telemetry = new HealingTelemetry();

// Start auto-logging only in non-test environments
if (process.env.NODE_ENV !== 'test') {
  telemetry.startAutoLogging();
}

// Log stats on process exit for final reporting
process.on('SIGTERM', () => {
  console.log('[TELEMETRY] Process terminating - final stats:');
  telemetry.logStats();
  telemetry.stopAutoLogging();
});

process.on('SIGINT', () => {
  console.log('[TELEMETRY] Process interrupted - final stats:');
  telemetry.logStats();
  telemetry.stopAutoLogging();
});
