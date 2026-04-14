import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DuckDbDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

// These tests run against a real in-memory DuckDB — no mocks needed.
// They require @duckdb/node-api to be installed; skip gracefully if not.

let driver: DuckDbDriver;
let conn: Connection;

const canRun = await (async () => {
  try {
    await import('@duckdb/node-api');
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!canRun)('DuckDbDriver (in-memory)', () => {
  beforeAll(async () => {
    driver = new DuckDbDriver();
    conn = await driver.connect({ name: 'test', type: 'duckdb', path: ':memory:' });
    // Create test fixtures
    await driver.execute(conn, `CREATE TABLE items (id INTEGER, name VARCHAR, price DOUBLE)`);
    await driver.execute(conn, `INSERT INTO items VALUES (1, 'apple', 1.50), (2, 'banana', 0.75), (3, 'cherry', 3.00)`);
    await driver.execute(conn, `CREATE TYPE mood AS ENUM ('happy', 'sad', 'neutral')`);
  });

  afterAll(async () => {
    await driver.disconnect(conn);
  });

  it('connect() and disconnect() lifecycle', async () => {
    const c = await driver.connect({ name: 't', type: 'duckdb', path: ':memory:' });
    expect(c.dialect).toBe('duckdb');
    expect(c.id).toBeTruthy();
    await driver.disconnect(c);
  });

  it('testConnection() returns success for valid path', async () => {
    const result = await driver.testConnection({ name: 't', type: 'duckdb', path: ':memory:' });
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('validateConnection() returns true on live connection', async () => {
    expect(await driver.validateConnection(conn)).toBe(true);
  });

  it('execute() SELECT returns batch with data, rows empty', async () => {
    const result = await driver.execute(conn, 'SELECT id, name, price FROM items ORDER BY id');
    expect(result.rows).toHaveLength(0);       // Arrow-native: rows is empty
    expect(result.batch).toBeDefined();
    expect(result.batch!.numRows).toBe(3);
    expect(result.rowCount).toBe(3);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    // Verify Arrow column access
    const ids = result.batch!.getChild('id');
    expect(ids?.get(0)).toBe(1);
  });

  it('execute() DDL returns rowCount 0, no batch', async () => {
    const result = await driver.execute(conn, `CREATE TABLE tmp_test (x INTEGER)`);
    expect(result.rowCount).toBe(0);
    await driver.execute(conn, `DROP TABLE tmp_test`);
  });

  it('execute() SELECT empty result returns rowCount 0', async () => {
    const result = await driver.execute(conn, `SELECT * FROM items WHERE id = 9999`);
    expect(result.rowCount).toBe(0);
  });

  it('streamBatches() yields RecordBatch instances', async () => {
    const batches: import('apache-arrow').RecordBatch[] = [];
    for await (const batch of driver.streamBatches!(conn, 'SELECT * FROM items ORDER BY id')) {
      batches.push(batch);
    }
    expect(batches.length).toBeGreaterThan(0);
    const totalRows = batches.reduce((s, b) => s + b.numRows, 0);
    expect(totalRows).toBe(3);
  });

  it('streamBatches() respects batchSize option', async () => {
    const batches: import('apache-arrow').RecordBatch[] = [];
    for await (const batch of driver.streamBatches!(conn, 'SELECT * FROM items', [], { batchSize: 1 })) {
      batches.push(batch);
      expect(batch.numRows).toBeLessThanOrEqual(1);
    }
    expect(batches.length).toBeGreaterThanOrEqual(3);
  });

  it('stream() (compat) yields plain JS objects', async () => {
    const rows: Record<string, unknown>[] = [];
    for await (const row of driver.stream(conn, 'SELECT id, name FROM items ORDER BY id')) {
      rows.push(row);
    }
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveProperty('id');
    expect(rows[0]).toHaveProperty('name');
  });

  it('beginTransaction / commit round-trip', async () => {
    const tx = await driver.beginTransaction(conn);
    await tx.query('INSERT INTO items VALUES (99, \'test\', 0.01)');
    await tx.commit();
    const check = await driver.execute(conn, 'SELECT COUNT(*) AS c FROM items WHERE id = 99');
    expect(extractFirstValue(check, 'c')).toBe(1); // committed row visible
    await driver.execute(conn, 'DELETE FROM items WHERE id = 99');
  });

  it('beginTransaction / rollback discards changes', async () => {
    const tx = await driver.beginTransaction(conn);
    await tx.query('INSERT INTO items VALUES (100, \'discard\', 0)');
    await tx.rollback();
    const check = await driver.execute(conn, 'SELECT COUNT(*) AS c FROM items WHERE id = 100');
    expect(extractFirstValue(check, 'c')).toBe(0);
  });

  it('getSchemas() returns at least main', async () => {
    const schemas = await driver.getSchemas(conn);
    expect(schemas.map(s => s.name)).toContain('main');
  });

  it('getTables() returns items table after creation', async () => {
    const tables = await driver.getTables(conn, 'main');
    expect(tables.map(t => t.name)).toContain('items');
  });

  it('getColumns() returns typed columns for items', async () => {
    const cols = await driver.getColumns(conn, 'main', 'items');
    expect(cols.map(c => c.name)).toEqual(['id', 'name', 'price']);
    const idCol = cols.find(c => c.name === 'id')!;
    expect(idCol.type).toBe('integer');
  });

  it('getTypes() returns ENUM type created above', async () => {
    const types = await driver.getTypes(conn, 'main');
    const mood = types.find(t => t.name === 'mood');
    expect(mood).toBeDefined();
    expect(mood?.type).toBe('enum');
    expect(mood?.values).toEqual(expect.arrayContaining(['happy', 'sad', 'neutral']));
  });

  it('mapNativeType() covers key type categories', () => {
    expect(driver.mapNativeType('INTEGER')).toBe('integer');
    expect(driver.mapNativeType('BIGINT')).toBe('integer');
    expect(driver.mapNativeType('DOUBLE')).toBe('float');
    expect(driver.mapNativeType('DECIMAL(10,2)')).toBe('decimal');
    expect(driver.mapNativeType('VARCHAR')).toBe('string');
    expect(driver.mapNativeType('BOOLEAN')).toBe('boolean');
    expect(driver.mapNativeType('DATE')).toBe('date');
    expect(driver.mapNativeType('TIMESTAMP')).toBe('timestamp');
    expect(driver.mapNativeType('UUID')).toBe('uuid');
    expect(driver.mapNativeType('BLOB')).toBe('binary');
    expect(driver.mapNativeType('JSON')).toBe('json');
  });

  it('capabilities() has arrowNative: true and embedded: true', () => {
    const caps = driver.capabilities();
    expect(caps.arrowNative).toBe(true);
    expect(caps.embedded).toBe(true);
    expect(caps.transactions).toBe(true);
    expect(caps.roles).toBe(false);
  });

  it('explain() returns a non-empty plan', async () => {
    const result = await driver.explain(conn, 'SELECT * FROM items');
    expect(result.dialect).toBe('duckdb');
    expect(typeof result.rawPlan).toBe('string');
    expect((result.rawPlan as string).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function extractFirstValue(result: import('@maitredb/plugin-api').QueryResult, col: string): unknown {
  let val: unknown;
  if (result.batch) {
    val = result.batch.getChild(col)?.get(0) ?? null;
  } else {
    val = result.rows[0]?.[col] ?? null;
  }
  // DuckDB returns COUNT(*) and similar aggregates as BigInt — coerce for test comparisons
  return typeof val === 'bigint' ? Number(val) : val;
}
