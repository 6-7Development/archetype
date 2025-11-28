import { logger, logError } from './logger';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Exponential backoff retry wrapper for async operations
 * Useful for API calls, database operations, and external service calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      logger.debug(`${operationName} - Attempt ${attempt}/${config.maxRetries}`);
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === config.maxRetries) {
        logError(`${operationName} failed after ${config.maxRetries} retries`, lastError, {
          operationName,
          totalAttempts: attempt,
        });
        throw lastError;
      }

      logger.warn(`${operationName} failed (attempt ${attempt}), retrying in ${delay}ms`, {
        operationName,
        attempt,
        nextRetryDelayMs: delay,
        error: lastError.message,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  throw lastError || new Error(`${operationName} failed`);
}

/**
 * Promise.race wrapper for timeout handling
 * Useful for preventing hanging requests
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * Circuit breaker pattern for preventing cascade failures
 * Tracks consecutive failures and temporarily fails fast
 */
export class CircuitBreaker<T> {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private operation: () => Promise<T>,
    private operationName: string,
    private failureThreshold = 5,
    private resetTimeoutMs = 60000
  ) {}

  async execute(): Promise<T> {
    if (this.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        logger.info(`${this.operationName} - Circuit breaker entering HALF_OPEN state`);
      } else {
        throw new Error(`${this.operationName} - Circuit breaker is OPEN`);
      }
    }

    try {
      const result = await this.operation();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
        logger.info(`${this.operationName} - Circuit breaker reset to CLOSED`);
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        logError(`${this.operationName} - Circuit breaker opened`, error as Error, {
          failureCount: this.failureCount,
          threshold: this.failureThreshold,
        });
      }

      throw error;
    }
  }

  getState() {
    return { state: this.state, failureCount: this.failureCount };
  }
}
