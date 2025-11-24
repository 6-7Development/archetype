/**
 * Gap #10: Subagent Failure Recovery & Retry Logic
 * Exponential backoff, circuit breaker, intelligent escalation
 */

export interface RetryConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

export interface RetryAttempt {
  attemptNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  error?: string;
  success: boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  backoffMultiplier: 2,
  timeoutMs: 60000,
};

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoff(attempt: number, config: RetryConfig): number {
  const exponential = Math.min(
    config.maxBackoffMs,
    config.initialBackoffMs * Math.pow(config.backoffMultiplier, attempt - 1),
  );
  const jitter = Math.random() * 0.1 * exponential; // 10% jitter
  return Math.floor(exponential + jitter);
}

/**
 * Categorize error for retry strategy
 */
export function categorizeError(error: any): 'network' | 'logic' | 'timeout' | 'unknown' {
  const message = error?.message?.toLowerCase() || '';

  if (message.includes('timeout')) return 'timeout';
  if (message.includes('econnrefused') || message.includes('enotfound')) return 'network';
  if (message.includes('validation') || message.includes('syntax')) return 'logic';

  return 'unknown';
}

/**
 * Determine if error is retryable
 */
export function isRetryable(errorType: string): boolean {
  return ['network', 'timeout'].includes(errorType);
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private threshold = 5;
  private resetTimeoutMs = 60000;

  isOpen(): boolean {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
        console.log('[CIRCUIT-BREAKER] Transitioning to half-open');
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      console.warn('[CIRCUIT-BREAKER] ⚠️ Circuit breaker OPEN after', this.failureCount, 'failures');
    }
  }

  getState() {
    return this.state;
  }
}

/**
 * Wrap function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const attempts: RetryAttempt[] = [];

  for (let attempt = 1; attempt <= mergedConfig.maxRetries; attempt++) {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), mergedConfig.timeoutMs),
        ),
      ]);

      attempts.push({
        attemptNumber: attempt,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        success: true,
      });

      console.log(`[RETRY] Success on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorType = categorizeError(error);

      attempts.push({
        attemptNumber: attempt,
        startTime,
        endTime,
        duration,
        error: error?.message,
        success: false,
      });

      console.warn(`[RETRY] Attempt ${attempt} failed (${errorType}):`, error?.message);

      // Don't retry if error is not retryable
      if (!isRetryable(errorType)) {
        console.error('[RETRY] Error is not retryable, giving up');
        throw error;
      }

      // Last attempt?
      if (attempt === mergedConfig.maxRetries) {
        console.error('[RETRY] Max retries exceeded, escalating');
        throw error;
      }

      // Backoff before retry
      const backoff = calculateBackoff(attempt, mergedConfig);
      console.log(`[RETRY] Backing off for ${backoff}ms before retry`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw new Error('Retry exhausted');
}
