/**
 * Simple in-memory LRU cache with TTL support
 * Used for caching frequently accessed data to reduce database load
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with TTL (in seconds)
   */
  set(key: string, value: T, ttlSeconds: number = 300): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Invalidate (delete) a cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of Array.from(this.cache.keys())) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : '0.00';
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

// Global cache instances
export const userCache = new LRUCache(500);
export const projectCache = new LRUCache(1000);
export const subscriptionCache = new LRUCache(500);
export const responseCache = new LRUCache(200); // For API response caching

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const userCleaned = userCache.cleanup();
  const projectCleaned = projectCache.cleanup();
  const subCleaned = subscriptionCache.cleanup();
  const respCleaned = responseCache.cleanup();
  
  const total = userCleaned + projectCleaned + subCleaned + respCleaned;
  if (total > 0) {
    console.log(`[CACHE] Cleaned ${total} expired entries`);
  }
}, 5 * 60 * 1000);

// Log cache stats every 10 minutes
setInterval(() => {
  console.log('[CACHE] Stats:', {
    user: userCache.getStats(),
    project: projectCache.getStats(),
    subscription: subscriptionCache.getStats(),
    response: responseCache.getStats(),
  });
}, 10 * 60 * 1000);
