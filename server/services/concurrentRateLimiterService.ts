/**
 * Gap #16: Concurrent Rate Limiting Awareness
 * Prevent parallel tools from overloading rate limiters
 * Shared token bucket across requests
 */

export interface RateLimitConfig {
  provider: 'gemini' | 'claude' | 'github' | 'custom';
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export interface RateLimitState {
  requestCount: number;
  tokenCount: number;
  lastResetTime: number;
}

class ConcurrentRateLimiter {
  private limits: Map<string, RateLimitConfig> = new Map();
  private state: Map<string, RateLimitState> = new Map();
  private resetIntervalMs = 60000; // 1 minute

  /**
   * Register rate limit for provider
   */
  registerLimit(config: RateLimitConfig) {
    this.limits.set(config.provider, config);
    this.state.set(config.provider, {
      requestCount: 0,
      tokenCount: 0,
      lastResetTime: Date.now(),
    });
  }

  /**
   * Check if request can proceed
   */
  async canExecute(
    provider: string,
    estimatedTokens: number,
  ): Promise<{ allowed: boolean; waitMs: number }> {
    const config = this.limits.get(provider);
    if (!config) {
      return { allowed: true, waitMs: 0 }; // No limit registered
    }

    const state = this.state.get(provider)!;
    this._resetIfNeeded(provider, state, config);

    const requests = state.requestCount;
    const tokens = state.tokenCount;

    // Check if limits exceeded
    if (requests >= config.requestsPerMinute) {
      const waitMs = this._calculateWaitTime(state);
      return { allowed: false, waitMs };
    }

    if (tokens + estimatedTokens > config.tokensPerMinute) {
      const waitMs = this._calculateWaitTime(state);
      return { allowed: false, waitMs };
    }

    return { allowed: true, waitMs: 0 };
  }

  /**
   * Record request execution
   */
  recordRequest(provider: string, tokensUsed: number) {
    const state = this.state.get(provider);
    if (state) {
      state.requestCount++;
      state.tokenCount += tokensUsed;
      console.log(
        `[RATE-LIMITER] ${provider}: ${state.requestCount} requests, ${state.tokenCount} tokens`,
      );
    }
  }

  /**
   * Wait for rate limit availability
   */
  async waitForAvailability(provider: string, estimatedTokens: number) {
    let attempts = 0;
    const maxAttempts = 60; // Max 1 minute wait

    while (attempts < maxAttempts) {
      const { allowed, waitMs } = await this.canExecute(provider, estimatedTokens);

      if (allowed) {
        return;
      }

      console.log(`[RATE-LIMITER] ${provider}: Waiting ${waitMs}ms before retry`);
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 1000)));
      attempts++;
    }

    throw new Error(`Rate limit timeout for ${provider}`);
  }

  private _resetIfNeeded(
    provider: string,
    state: RateLimitState,
    config: RateLimitConfig,
  ) {
    if (Date.now() - state.lastResetTime > this.resetIntervalMs) {
      state.requestCount = 0;
      state.tokenCount = 0;
      state.lastResetTime = Date.now();
      console.log(`[RATE-LIMITER] ${provider}: Reset limits`);
    }
  }

  private _calculateWaitTime(state: RateLimitState): number {
    const elapsedMs = Date.now() - state.lastResetTime;
    const remainingMs = this.resetIntervalMs - elapsedMs;
    return Math.max(100, remainingMs);
  }
}

export const concurrentRateLimiter = new ConcurrentRateLimiter();

// Initialize default limits
concurrentRateLimiter.registerLimit({
  provider: 'gemini',
  requestsPerMinute: 100,
  tokensPerMinute: 1000000,
});

concurrentRateLimiter.registerLimit({
  provider: 'claude',
  requestsPerMinute: 50,
  tokensPerMinute: 500000,
});
