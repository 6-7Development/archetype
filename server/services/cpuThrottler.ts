/**
 * CPU Throttling Service
 * Prevents CPU usage spikes by throttling expensive operations
 */

interface ThrottleConfig {
  maxCpuPercent: number;
  checkInterval: number;
  throttleDelay: number;
  maxThrottleTime: number;
}

class CpuThrottler {
  private config: ThrottleConfig = {
    maxCpuPercent: 75,
    checkInterval: 5000,
    throttleDelay: 100,
    maxThrottleTime: 10000,
  };
  
  private lastCpuUsage = process.cpuUsage();
  private lastCheckTime = Date.now();
  private isThrottled = false;
  private throttleStartTime = 0;
  
  /**
   * Check current CPU usage and determine if throttling is needed
   */
  private async checkCpuUsage(): Promise<{ cpuPercent: number; shouldThrottle: boolean }> {
    const currentTime = Date.now();
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    
    const elapsedTimeMs = currentTime - this.lastCheckTime;
    const totalCpuTime = (currentCpuUsage.user + currentCpuUsage.system) / 1000;
    const cpuPercent = (totalCpuTime / elapsedTimeMs) * 100;
    
    this.lastCpuUsage = process.cpuUsage();
    this.lastCheckTime = currentTime;
    
    const shouldThrottle = cpuPercent > this.config.maxCpuPercent;
    
    return { cpuPercent, shouldThrottle };
  }
  
  /**
   * Throttle execution if CPU usage is too high
   */
  public async throttleIfNeeded(): Promise<void> {
    const { cpuPercent, shouldThrottle } = await this.checkCpuUsage();
    
    if (shouldThrottle) {
      if (!this.isThrottled) {
        this.isThrottled = true;
        this.throttleStartTime = Date.now();
        console.warn(`🐌 CPU throttling activated: ${cpuPercent.toFixed(1)}% usage`);
      }
      
      // Check if we've been throttling too long (circuit breaker)
      const throttleDuration = Date.now() - this.throttleStartTime;
      if (throttleDuration > this.config.maxThrottleTime) {
        console.error(`🚨 CPU throttle timeout after ${throttleDuration}ms - disabling throttling`);
        this.isThrottled = false;
        return;
      }
      
      // Apply throttle delay
      await new Promise(resolve => setTimeout(resolve, this.config.throttleDelay));
    } else {
      if (this.isThrottled) {
        const throttleDuration = Date.now() - this.throttleStartTime;
        console.log(`✅ CPU throttling deactivated after ${throttleDuration}ms`);
        this.isThrottled = false;
      }
    }
  }
  
  /**
   * Wrap a function with CPU throttling
   */
  public async withThrottling<T>(fn: () => Promise<T>): Promise<T> {
    await this.throttleIfNeeded();
    return await fn();
  }
  
  /**
   * Configure throttling parameters
   */
  public configure(config: Partial<ThrottleConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Get current throttling status
   */
  public getStatus(): { isThrottled: boolean; throttleDuration: number } {
    return {
      isThrottled: this.isThrottled,
      throttleDuration: this.isThrottled ? Date.now() - this.throttleStartTime : 0,
    };
  }
}

export const cpuThrottler = new CpuThrottler();