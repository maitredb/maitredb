import { randomUUID } from 'node:crypto';
import type { DriverAdapter, Connection, QueryResult } from '@maitredb/plugin-api';
import type { AuditEntry } from './types.js';
import { MaitreError, MaitreErrorCode } from './errors.js';

const DEFAULT_MAX_BUFFERED_ROWS = 10000;

const DDL_PATTERN = /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\b/i;
const PERMISSION_DDL_PATTERN = /^\s*(GRANT|REVOKE)\b/i;

/** Lightweight DDL detector used for cache invalidation. */
export function isDDL(sql: string): boolean {
  return DDL_PATTERN.test(sql);
}

/**
 * Wraps a DriverAdapter to provide consistent error handling and
 * timing metadata. The executor enforces the "streaming-first" guarantee by
 * delegating to the driver for both buffered and streamed paths.
 */
export interface ExecutorOptions {
  maxBufferedRows?: number;
  cache?: {
    invalidateForConnection(
      connectionId: string,
      dialect: string,
      scope: 'schema' | 'permissions' | 'all',
    ): Promise<void> | void;
  };
  history?: {
    record(entry: AuditEntry): Promise<void> | void;
  };
  connectionId?: string;
  connectionName?: string;
  caller?: 'human' | 'agent' | 'programmatic';
  logParamsForProduction?: boolean;
}

export class QueryExecutor {
  private readonly maxBufferedRows: number;

  constructor(
    private readonly adapter: DriverAdapter,
    private readonly options: ExecutorOptions = {},
  ) {
    this.maxBufferedRows = options.maxBufferedRows ?? DEFAULT_MAX_BUFFERED_ROWS;
  }

  /** Execute a SQL statement and capture timing metadata. */
  async execute(conn: Connection, sql: string, params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    try {
      const result = await this.adapter.execute(conn, sql, params);
      result.durationMs = performance.now() - start;

      if (isDDL(sql) && this.options.cache && this.options.connectionId) {
        const scope = PERMISSION_DDL_PATTERN.test(sql) ? 'permissions' : 'schema';
        await this.options.cache.invalidateForConnection(this.options.connectionId, conn.dialect, scope);
      }

      await this.recordHistory({
        id: randomUUID(),
        timestamp: new Date(),
        connection: this.options.connectionName ?? conn.config.name ?? this.options.connectionId ?? conn.id,
        dialect: conn.dialect,
        caller: this.options.caller ?? 'programmatic',
        query: sql,
        params: shouldRecordParams(conn, params, this.options.logParamsForProduction),
        durationMs: result.durationMs,
        rowsReturned: result.rows.length,
        rowsAffected: result.rows.length === 0 ? result.rowCount : undefined,
      });

      return result;
    } catch (err) {
      const wrapped = this.wrapError(err, conn);
      await this.recordHistory({
        id: randomUUID(),
        timestamp: new Date(),
        connection: this.options.connectionName ?? conn.config.name ?? this.options.connectionId ?? conn.id,
        dialect: conn.dialect,
        caller: this.options.caller ?? 'programmatic',
        query: sql,
        params: shouldRecordParams(conn, params, this.options.logParamsForProduction),
        durationMs: performance.now() - start,
        error: {
          code: wrapped.code,
          message: wrapped.message,
        },
      });
      throw wrapped;
    }
  }

  /** Stream rows directly from the adapter while preserving error semantics. */
  async *stream(
    conn: Connection,
    sql: string,
    params?: unknown[],
  ): AsyncIterable<Record<string, unknown>> {
    try {
      yield* this.adapter.stream(conn, sql, params);
    } catch (err) {
      throw this.wrapError(err, conn);
    }
  }

  private wrapError(err: unknown, conn: Connection): MaitreError {
    if (err instanceof MaitreError) return err;
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('syntax') || message.includes('SQLITE_ERROR')) {
      return new MaitreError(MaitreErrorCode.SYNTAX_ERROR, message, conn.dialect);
    }
    return new MaitreError(MaitreErrorCode.EXECUTION_ERROR, message, conn.dialect);
  }

  private async recordHistory(entry: AuditEntry): Promise<void> {
    if (!this.options.history) return;
    try {
      await this.options.history.record(entry);
    } catch {
      // history failures are non-fatal for query execution
    }
  }
}

function shouldRecordParams(
  conn: Connection,
  params: unknown[] | undefined,
  logParamsForProduction: boolean | undefined,
): unknown[] | undefined {
  if (!params) return undefined;

  const hasProductionTag = (conn.config.tags ?? []).some((tag) => tag.toLowerCase() === 'production');
  if (!hasProductionTag || logParamsForProduction) {
    return params;
  }
  return undefined;
}
