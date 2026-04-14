import type { RecordBatch, Vector } from 'apache-arrow';
import type { FieldInfo, QueryResult } from '@maitredb/plugin-api';
import { recordBatchToRows } from './arrow-utils.js';

const TOOBJECTS_WARN_THRESHOLD = 10_000;

/**
 * Ergonomic wrapper around a QueryResult that carries an Arrow RecordBatch.
 * Provides column-level access and a Proxy-based lazy row iterator that reads
 * directly from Arrow column buffers — no per-row JS object allocation until
 * a property is accessed.
 */
export class ArrowResult {
  constructor(private readonly _result: QueryResult) {
    if (!_result.batch) {
      throw new Error('ArrowResult requires a QueryResult with a populated batch field.');
    }
  }

  /** Access a named column as an Arrow Vector. O(1). */
  column(name: string): Vector {
    const col = this._result.batch!.getChild(name);
    if (!col) throw new Error(`Column '${name}' not found in result batch.`);
    return col;
  }

  /**
   * Lazy Proxy-based row iterator. Each property access reads from the Arrow
   * column buffer — no row-level object is allocated until a property is read.
   */
  rows(): Iterable<Record<string, unknown>> {
    const batch = this._result.batch!;
    return {
      [Symbol.iterator]() {
        let idx = 0;
        return {
          next() {
            if (idx >= batch.numRows) return { done: true as const, value: undefined };
            const i = idx++;
            const row = new Proxy({ __i: i } as Record<string, unknown>, {
              get(target, prop: string) {
                if (prop === '__i') return target.__i;
                return batch.getChild(prop)?.get(i) ?? undefined;
              },
              ownKeys() {
                return batch.schema.fields.map(f => f.name);
              },
              getOwnPropertyDescriptor(_t, prop: string) {
                if (batch.getChild(prop) !== null) {
                  return { configurable: true, enumerable: true, writable: false };
                }
                return undefined;
              },
              has(_t, prop: string) {
                return batch.schema.fields.some(f => f.name === prop);
              },
            });
            return { done: false, value: row as Record<string, unknown> };
          },
        };
      },
    };
  }

  /**
   * Materialise all rows as plain JS objects.
   * Logs a warning to stderr when rowCount exceeds 10,000 — consider .rows() instead.
   */
  toObjects(): Record<string, unknown>[] {
    if (this._result.rowCount > TOOBJECTS_WARN_THRESHOLD) {
      process.stderr.write(
        `[maitredb] ArrowResult.toObjects() called on ${this._result.rowCount} rows — ` +
          `consider using .rows() for lazy iteration to avoid large allocations.\n`,
      );
    }
    return recordBatchToRows(this._result.batch!);
  }

  get raw(): QueryResult { return this._result; }
  get rowCount(): number { return this._result.rowCount; }
  get fields(): FieldInfo[] { return this._result.fields; }
  get durationMs(): number { return this._result.durationMs; }
}
