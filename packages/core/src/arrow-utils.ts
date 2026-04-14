import {
  type RecordBatch,
  type DataType,
  Utf8,
  Float64,
  Bool,
  Int32,
  tableFromArrays,
} from 'apache-arrow';
import type { FieldInfo, MaitreType } from '@maitredb/plugin-api';

/**
 * Map a MaitreType to the closest Apache Arrow DataType for schema building.
 * Falls back to Utf8 for unknown/complex types (json, array, geometry).
 */
export function maitreTypeToArrow(type: MaitreType): DataType {
  switch (type) {
    case 'boolean': return new Bool();
    case 'integer': return new Int32();
    case 'float':
    case 'decimal':
    case 'number': return new Float64();
    default: return new Utf8();
  }
}

/**
 * Convert an array of JS objects + FieldInfo metadata into an Arrow RecordBatch.
 * Uses tableFromArrays which handles schema inference automatically.
 */
export function rowsToRecordBatch(
  rows: Record<string, unknown>[],
  fields: FieldInfo[],
): RecordBatch {
  if (rows.length === 0) {
    // Empty result — build from empty arrays so schema is preserved
    const effectiveFields = fields.length > 0
      ? fields
      : [];
    const columnArrays: Record<string, unknown[]> = {};
    for (const f of effectiveFields) {
      columnArrays[f.name] = [];
    }
    return tableFromArrays(columnArrays).batches[0]!;
  }

  // Build column arrays from the field list (or infer from first row)
  const effectiveFields = fields.length > 0
    ? fields
    : Object.keys(rows[0]!).map(name => ({ name, nativeType: 'unknown', type: 'unknown' as MaitreType }));

  const columnArrays: Record<string, unknown[]> = {};
  for (const f of effectiveFields) {
    columnArrays[f.name] = rows.map(r => r[f.name] ?? null);
  }

  const table = tableFromArrays(columnArrays);
  return table.batches[0]!;
}

/**
 * Materialise an Arrow RecordBatch into an array of plain JS objects.
 * Reads each column vector sequentially — one allocation per row.
 */
export function recordBatchToRows(batch: RecordBatch): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const fieldNames = batch.schema.fields.map(f => f.name);
  for (let i = 0; i < batch.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (const name of fieldNames) {
      row[name] = batch.getChild(name)?.get(i) ?? null;
    }
    result.push(row);
  }
  return result;
}

/**
 * Async generator that reads rows from a JS-object async iterable, buffers up to
 * batchSize rows, then yields a RecordBatch. FieldInfo may be empty — types will
 * be inferred as Utf8 from the first row's keys in that case.
 */
export async function* batchRows(
  source: AsyncIterable<Record<string, unknown>>,
  fields: FieldInfo[],
  batchSize: number,
): AsyncIterable<RecordBatch> {
  let buf: Record<string, unknown>[] = [];
  let inferredFields = fields;

  for await (const row of source) {
    if (inferredFields.length === 0 && buf.length === 0) {
      // Infer field names from first row; types unknown → Utf8
      inferredFields = Object.keys(row).map(name => ({
        name,
        nativeType: 'unknown',
        type: 'unknown' as MaitreType,
        nullable: true,
      }));
    }
    buf.push(row);
    if (buf.length >= batchSize) {
      yield rowsToRecordBatch(buf, inferredFields);
      buf = [];
    }
  }
  if (buf.length > 0) {
    yield rowsToRecordBatch(buf, inferredFields);
  }
}
