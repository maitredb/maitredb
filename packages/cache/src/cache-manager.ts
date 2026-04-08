import { homedir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseDialect } from '@maitredb/plugin-api';
import type { CacheOptions } from '@maitredb/core';
import { buildCacheKey, invalidationPattern } from './cache-key.js';
import { DiskCache } from './disk-cache.js';
import { MemoryCache } from './memory-cache.js';

const DEFAULT_OPTIONS: Required<CacheOptions> = {
  enabled: true,
  memoryMaxItems: 500,
  diskEnabled: true,
  diskPath: join(homedir(), '.maitredb', 'cache.db'),
  schemaTtlMs: 300_000,
  permissionTtlMs: 120_000,
  queryResultCaching: false,
};

/**
 * Two-tier cache manager (memory + optional disk).
 */
export class CacheManager {
  private readonly options: Required<CacheOptions>;
  private readonly memory: MemoryCache;
  private readonly disk?: DiskCache;

  constructor(options: CacheOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.memory = new MemoryCache(this.options.memoryMaxItems);
    if (this.options.diskEnabled) {
      const disk = new DiskCache(this.options.diskPath);
      if (disk.isAvailable()) {
        this.disk = disk;
      }
    }
  }

  /**
   * Return true when caching is enabled by configuration.
   */
  isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Return cache TTL for a metadata scope.
   */
  ttlFor(scope: 'schema' | 'permissions'): number {
    return scope === 'schema' ? this.options.schemaTtlMs : this.options.permissionTtlMs;
  }

  /**
   * Resolve a key from memory first, then disk.
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (!this.options.enabled) return undefined;

    const memoryValue = this.memory.get<T>(key);
    if (memoryValue !== undefined) {
      return memoryValue;
    }

    if (!this.disk) {
      return undefined;
    }

    const diskValue = this.disk.get<T>(key);
    if (!diskValue) {
      return undefined;
    }

    const remainingTtlMs = Math.max(1, diskValue.expiresAt - Date.now());
    this.memory.set(key, diskValue.value, remainingTtlMs);
    return diskValue.value;
  }

  /**
   * Write key/value pair to configured cache tiers.
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!this.options.enabled) return;

    this.memory.set(key, value, ttlMs);
    this.disk?.set(key, value, ttlMs);
  }

  /**
   * Resolve from cache or load from source and populate cache.
   */
  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const loaded = await loader();
    await this.set(key, loaded, ttlMs);
    return loaded;
  }

  /**
   * Invalidate keys matching a regex pattern.
   */
  async invalidate(pattern: RegExp): Promise<void> {
    this.memory.invalidate(pattern);
    if (!this.disk) {
      return;
    }
    this.disk.invalidateByRegex(pattern);
  }

  /**
   * Invalidate schema/permission cache entries for one connection.
   */
  async invalidateForConnection(
    connectionId: string,
    dialect: DatabaseDialect,
    scope: 'schema' | 'permissions' | 'all',
  ): Promise<void> {
    await this.invalidate(invalidationPattern(connectionId, dialect, scope));
  }

  /**
   * Build canonical key format for callers.
   */
  buildKey(
    connectionId: string,
    dialect: DatabaseDialect,
    operation: string,
    schema?: string,
    object?: string,
  ): string {
    return buildCacheKey(connectionId, dialect, operation, schema, object);
  }

  /**
   * Clear all cache tiers.
   */
  clear(): void {
    this.memory.clear();
    this.disk?.clear();
  }

  /**
   * Close optional resources.
   */
  close(): void {
    this.disk?.close();
  }
}
