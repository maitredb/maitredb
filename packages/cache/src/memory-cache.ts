import { LRUCache } from 'lru-cache';

export interface MemoryCacheStats {
  hits: number;
  misses: number;
}

/**
 * In-memory LRU cache wrapper used as the fast cache tier.
 */
export class MemoryCache {
  private readonly cache: LRUCache<string, any>;
  private hits = 0;
  private misses = 0;

  constructor(maxItems: number) {
    this.cache = new LRUCache<string, any>({ max: maxItems });
  }

  /**
   * Retrieve a cached value by key.
   */
  get<T>(key: string): T | undefined {
    const value = this.cache.get(key);
    if (value === undefined) {
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return value as T;
  }

  /**
   * Store a value with a TTL in milliseconds.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, value, { ttl: ttlMs });
  }

  /**
   * Invalidate keys matching a pattern.
   */
  invalidate(pattern: RegExp): number {
    let removed = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Return hit/miss counters.
   */
  get stats(): MemoryCacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
    };
  }
}
