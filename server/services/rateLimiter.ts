/**
 * Token Bucket Rate Limiter for Gemini API
 * Prevents request bursts by enforcing smooth traffic distribution
 * 
 * Limits: 1,000,000 tokens per minute for gemini-2.0-flash-exp
 * Strategy: Conservative limit at 900,000 TPM (90%) for safety margin
 * 
 * Architecture:
 * - Token Bucket Algorithm: Refills at constant rate (15,000 tokens/second)
 * - Queue System: Requests wait in FIFO queue when bucket is empty
 * - Graceful Degradation: Prevents burst traffic while allowing steady flow
 */

class TokenBucketRateLimiter {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per millisecond
  private lastRefill: number;
  private readonly queue: Array<{resolve: () => void; tokens: number}> = [];
  private processingQueue: boolean = false;

  constructor(tokensPerMinute: number) {
    this.capacity = tokensPerMinute;
    this.tokens = tokensPerMinute; // Start with full bucket
    this.refillRate = tokensPerMinute / 60000; // tokens per ms
    this.lastRefill = Date.now();
    
    console.log(`[RATE-LIMITER-INIT] Token Bucket initialized: ${tokensPerMinute.toLocaleString()} tokens/min`);
    console.log(`[RATE-LIMITER-INIT] Refill rate: ${this.refillRate.toFixed(2)} tokens/ms`);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed * this.refillRate);
    
    if (tokensToAdd > 0) {
      const oldTokens = this.tokens;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
      
      if (this.tokens !== oldTokens) {
        console.log(`[RATE-LIMITER-REFILL] +${tokensToAdd} tokens (${oldTokens} → ${this.tokens})`);
      }
    }
  }

  /**
   * Acquire tokens for a request
   * - If tokens available: immediate approval
   * - If tokens unavailable: queue and wait
   * - If request exceeds capacity: reject immediately (prevents infinite hang)
   */
  async acquire(tokenCount: number): Promise<void> {
    // Guard: Reject requests that exceed bucket capacity
    if (tokenCount > this.capacity) {
      throw new Error(
        `Request requires ${tokenCount} tokens but bucket capacity is ${this.capacity}. ` +
        `Please break this request into smaller tasks or use a different model.`
      );
    }

    this.refill();

    // Fast path: tokens available immediately
    if (this.tokens >= tokenCount) {
      this.tokens -= tokenCount;
      console.log(`[RATE-LIMITER-ACQUIRE] ✅ ${tokenCount} tokens acquired (${this.tokens} remaining)`);
      return Promise.resolve();
    }

    // Slow path: queue the request
    console.log(`[RATE-LIMITER-QUEUE] Queueing request for ${tokenCount} tokens (only ${this.tokens} available)`);
    
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve, tokens: tokenCount });
      this.processQueue();
    });
  }

  /**
   * Process queued requests as tokens become available
   */
  private processQueue(): void {
    // Prevent concurrent queue processing
    if (this.processingQueue) return;
    this.processingQueue = true;

    const tryProcessNext = () => {
      this.refill();

      while (this.queue.length > 0) {
        const next = this.queue[0];
        
        if (this.tokens >= next.tokens) {
          // Tokens available - approve request
          this.tokens -= next.tokens;
          this.queue.shift();
          console.log(`[RATE-LIMITER-DEQUEUE] ✅ ${next.tokens} tokens acquired from queue (${this.tokens} remaining, ${this.queue.length} queued)`);
          next.resolve();
        } else {
          // Not enough tokens yet - wait and try again
          const waitTime = Math.ceil((next.tokens - this.tokens) / this.refillRate);
          console.log(`[RATE-LIMITER-WAIT] ⏱️ Waiting ${waitTime}ms for tokens to refill (need ${next.tokens}, have ${this.tokens})`);
          setTimeout(tryProcessNext, Math.min(waitTime, 1000)); // Max 1s wait between checks
          return;
        }
      }

      // Queue empty
      this.processingQueue = false;
    };

    tryProcessNext();
  }

  /**
   * Get current rate limiter stats (for monitoring/debugging)
   */
  getStats(): { tokens: number; capacity: number; queueLength: number } {
    this.refill();
    return {
      tokens: this.tokens,
      capacity: this.capacity,
      queueLength: this.queue.length,
    };
  }
}

/**
 * Singleton instance for Gemini API rate limiting
 * - 900,000 tokens/min (90% of 1M limit for safety margin)
 */
export const geminiRateLimiter = new TokenBucketRateLimiter(900000);

/**
 * Exponential backoff with jitter for 429 retry handling
 * 
 * Strategy:
 * - Base delay from API error (usually 47s for 429)
 * - Exponential multiplier: 2^attempt
 * - Random jitter: 0-1000ms to prevent thundering herd
 * - Max delay cap: 60s
 * 
 * @param attempt - Retry attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds (from API error or default 1000ms)
 * @param maxDelay - Maximum delay cap (default 60s)
 */
export async function exponentialBackoffWithJitter(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 60000
): Promise<void> {
  const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  const jitter = Math.random() * 1000; // 0-1000ms random jitter
  const totalDelay = exponentialDelay + jitter;
  
  console.log(`[RATE-LIMIT-BACKOFF] ⏳ Waiting ${Math.round(totalDelay)}ms before retry (attempt ${attempt + 1}, base: ${baseDelay}ms, exponential: ${Math.round(exponentialDelay)}ms, jitter: +${Math.round(jitter)}ms)`);
  
  await new Promise(resolve => setTimeout(resolve, totalDelay));
}

/**
 * Estimate token count from text (rough approximation)
 * Rule of thumb: 1 token ≈ 4 characters
 * 
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
