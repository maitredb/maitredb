import type { DriverAdapter, Connection, QueryResult } from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from './errors.js';

const DEFAULT_MAX_BUFFERED_ROWS = 10000;

const DDL_PATTERN = /^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\b/i;

/** Lightweight DDL detector used for cache invalidation. */
export function isDDL(sql: string): boolean {
  return DDL_PATTERN.test(sql);
}

/**
 * Wraps a DriverAdapter to provide consistent error handling and
 * timing metadata. The executor enforces the "streaming-first" guarantee by
 * delegating to the driver for both buffered and streamed paths.
 */
export class QueryExecutor {
  constructor(
    private adapter: DriverAdapter,
    private maxBufferedRows: number = DEFAULT_MAX_BUFFERED_ROWS,
  ) {}

  /** Execute a SQL statement and capture timing metadata. */
  async execute(conn: Connection, sql: string, params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    try {
      const result = await this.adapter.execute(conn, sql, params);
      result.durationMs = performance.now() - start;
      return result;
    } catch (err) {
      throw this.wrapError(err, conn);
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
}
