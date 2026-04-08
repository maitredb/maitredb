import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import type { AuditEntry } from './types.js';

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

export interface HistoryStoreOptions {
  enabled?: boolean;
  dbPath?: string;
  maxSizeMb?: number;
  databaseCtor?: BetterSqlite3Ctor | null;
}

export interface HistoryQueryOptions {
  connection?: string;
  last?: number;
  since?: Date;
}

const DEFAULT_HISTORY_PATH = join(homedir(), '.maitredb', 'history.db');

/**
 * Persistent query history/audit store backed by optional better-sqlite3.
 */
export class HistoryStore {
  private readonly enabled: boolean;
  private readonly maxSizeMb: number;
  private readonly dbPath: string;
  private readonly db?: BetterSqlite3Database;

  constructor(options: HistoryStoreOptions = {}) {
    this.enabled = options.enabled ?? true;
    this.maxSizeMb = options.maxSizeMb ?? 100;
    this.dbPath = options.dbPath ?? DEFAULT_HISTORY_PATH;

    if (!this.enabled) {
      return;
    }

    const DatabaseCtor = options.databaseCtor === undefined ? loadBetterSqlite3() : options.databaseCtor;
    if (!DatabaseCtor) {
      return;
    }

    mkdirSync(dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseCtor(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        connection TEXT NOT NULL,
        dialect TEXT NOT NULL,
        caller TEXT NOT NULL,
        query TEXT NOT NULL,
        params TEXT,
        duration_ms REAL NOT NULL,
        rows_affected INTEGER,
        rows_returned INTEGER,
        error_code INTEGER,
        error_message TEXT,
        policy_applied TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_connection ON history(connection);
      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history(timestamp);
    `);
  }

  /**
   * True when history backend is available and enabled.
   */
  isAvailable(): boolean {
    return !!this.db;
  }

  /**
   * Persist one audit entry.
   */
  record(entry: AuditEntry): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT INTO history(
        id, timestamp, connection, dialect, caller, query, params, duration_ms,
        rows_affected, rows_returned, error_code, error_message, policy_applied, created_at
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.timestamp.getTime(),
      entry.connection,
      entry.dialect,
      entry.caller,
      entry.query,
      entry.params ? JSON.stringify(entry.params) : null,
      entry.durationMs,
      entry.rowsAffected ?? null,
      entry.rowsReturned ?? null,
      entry.error?.code ?? null,
      entry.error?.message ?? null,
      entry.policyApplied ?? null,
      Date.now(),
    );

    this.maybeRotate(this.maxSizeMb);
  }

  /**
   * Query recent history entries.
   */
  query(options: HistoryQueryOptions = {}): AuditEntry[] {
    if (!this.db) return [];

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (options.connection) {
      clauses.push('connection = ?');
      params.push(options.connection);
    }
    if (options.since) {
      clauses.push('timestamp >= ?');
      params.push(options.since.getTime());
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = options.last ?? 20;
    params.push(limit);

    const rows = this.db.prepare(`
      SELECT
        id, timestamp, connection, dialect, caller, query, params, duration_ms,
        rows_affected, rows_returned, error_code, error_message, policy_applied
      FROM history
      ${where}
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(...params);

    return rows.map((row) => ({
      id: String(row['id']),
      timestamp: new Date(Number(row['timestamp'])),
      connection: String(row['connection']),
      dialect: row['dialect'] as AuditEntry['dialect'],
      caller: row['caller'] as AuditEntry['caller'],
      query: String(row['query']),
      params: row['params'] ? JSON.parse(String(row['params'])) as unknown[] : undefined,
      durationMs: Number(row['duration_ms']),
      rowsAffected: row['rows_affected'] === null ? undefined : Number(row['rows_affected']),
      rowsReturned: row['rows_returned'] === null ? undefined : Number(row['rows_returned']),
      error: row['error_code'] === null
        ? undefined
        : {
            code: Number(row['error_code']) as AuditEntry['error'] extends { code: infer C } ? C : never,
            message: String(row['error_message'] ?? ''),
          },
      policyApplied: row['policy_applied'] === null ? undefined : String(row['policy_applied']),
    }));
  }

  /**
   * Rotate store by deleting the oldest 20% of rows if file exceeds max size.
   */
  maybeRotate(maxSizeMb = this.maxSizeMb): void {
    if (!this.db || !existsSync(this.dbPath)) return;

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (statSync(this.dbPath).size <= maxBytes) return;

    const total = Number(this.db.prepare(`SELECT COUNT(*) AS count FROM history`).get()?.['count'] ?? 0);
    if (total <= 0) return;
    const toDelete = Math.max(1, Math.floor(total * 0.2));

    this.db.prepare(`
      DELETE FROM history
      WHERE id IN (
        SELECT id
        FROM history
        ORDER BY timestamp ASC
        LIMIT ?
      )
    `).run(toDelete);
  }

  /**
   * Close underlying database handle when present.
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
