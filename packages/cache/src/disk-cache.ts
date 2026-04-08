import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

interface BetterSqlite3Database {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    run(...params: unknown[]): { changes: number };
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
}

interface BetterSqlite3Ctor {
  new (path: string): BetterSqlite3Database;
}

export interface DiskCacheValue<T> {
  value: T;
  expiresAt: number;
}

/**
 * Optional disk-backed cache layer implemented with better-sqlite3.
 */
export class DiskCache {
  private readonly db?: BetterSqlite3Database;

  constructor(private readonly dbPath: string, databaseCtor?: BetterSqlite3Ctor | null) {
    const DatabaseCtor = databaseCtor === undefined ? loadBetterSqlite3() : databaseCtor;
    if (!DatabaseCtor) {
      return;
    }

    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseCtor(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
    `);
  }

  /**
   * Return true when the disk backend is available.
   */
  isAvailable(): boolean {
    return !!this.db;
  }

  /**
   * Read a non-expired key from disk.
   */
  get<T>(key: string): DiskCacheValue<T> | undefined {
    if (!this.db) return undefined;

    const now = Date.now();
    const row = this.db.prepare(`
      SELECT value, expires_at
      FROM cache
      WHERE key = ?
        AND expires_at > ?
    `).get(key, now);

    if (!row) {
      this.db.prepare(`DELETE FROM cache WHERE key = ? AND expires_at <= ?`).run(key, now);
      return undefined;
    }

    try {
      return {
        value: JSON.parse(String(row['value'])) as T,
        expiresAt: Number(row['expires_at']),
      };
    } catch {
      this.db.prepare(`DELETE FROM cache WHERE key = ?`).run(key);
      return undefined;
    }
  }

  /**
   * Upsert one key/value pair on disk with TTL.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    if (!this.db) return;

    const createdAt = Date.now();
    const expiresAt = createdAt + ttlMs;
    this.db.prepare(`
      INSERT INTO cache(key, value, expires_at, created_at)
      VALUES(?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        expires_at = excluded.expires_at,
        created_at = excluded.created_at
    `).run(key, JSON.stringify(value), expiresAt, createdAt);
  }

  /**
   * Invalidate all keys with the provided string prefix.
   */
  invalidate(prefix: string): number {
    if (!this.db) return 0;
    return this.db.prepare(`DELETE FROM cache WHERE key LIKE ?`).run(`${prefix}%`).changes;
  }

  /**
   * Invalidate keys matching a regular expression.
   */
  invalidateByRegex(pattern: RegExp): number {
    if (!this.db) return 0;

    const rows = this.db.prepare(`SELECT key FROM cache`).all();
    let removed = 0;
    const deleteStmt = this.db.prepare(`DELETE FROM cache WHERE key = ?`);

    for (const row of rows) {
      const key = String(row['key']);
      if (pattern.test(key)) {
        removed += deleteStmt.run(key).changes;
      }
    }

    return removed;
  }

  /**
   * Remove all cached disk rows.
   */
  clear(): void {
    if (!this.db) return;
    this.db.prepare(`DELETE FROM cache`).run();
  }

  /**
   * Close the underlying sqlite database handle.
   */
  close(): void {
    this.db?.close();
  }
}

function loadBetterSqlite3(): BetterSqlite3Ctor | undefined {
  const require = createRequire(import.meta.url);
  try {
    return require('better-sqlite3') as BetterSqlite3Ctor;
  } catch {
    return undefined;
  }
}
