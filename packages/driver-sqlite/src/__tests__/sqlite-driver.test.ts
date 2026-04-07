import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

describe('SqliteDriver', () => {
  const driver = new SqliteDriver();
  let conn: Connection;

  beforeEach(async () => {
    conn = await driver.connect({ name: 'test', type: 'sqlite', path: ':memory:' });
    await driver.execute(conn, 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT, age INTEGER)');
    await driver.execute(conn, "INSERT INTO users VALUES (1, 'Alice', 'alice@example.com', 30)");
    await driver.execute(conn, "INSERT INTO users VALUES (2, 'Bob', 'bob@test.com', 25)");
    await driver.execute(conn, "INSERT INTO users VALUES (3, 'Charlie', NULL, 35)");
  });

  afterEach(async () => {
    await driver.disconnect(conn);
  });

  describe('connect/disconnect', () => {
    it('connects to in-memory database', () => {
      expect(conn.dialect).toBe('sqlite');
      expect(conn.id).toBeTruthy();
    });
  });

  describe('testConnection', () => {
    it('returns success with version', async () => {
      const result = await driver.testConnection({ name: 'test', type: 'sqlite', path: ':memory:' });
      expect(result.success).toBe(true);
      expect(result.serverVersion).toMatch(/^\d+\.\d+/);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute', () => {
    it('returns rows and fields', async () => {
      const result = await driver.execute(conn, 'SELECT * FROM users ORDER BY id');
      expect(result.rowCount).toBe(3);
      expect(result.rows[0]).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com', age: 30 });
      expect(result.fields).toHaveLength(4);
      expect(result.fields[0]!.name).toBe('id');
      expect(result.fields[0]!.type).toBe('integer');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles parameterized queries', async () => {
      const result = await driver.execute(conn, 'SELECT * FROM users WHERE age > ?', [28]);
      expect(result.rowCount).toBe(2);
    });

    it('handles INSERT and returns changes', async () => {
      const result = await driver.execute(conn, "INSERT INTO users VALUES (4, 'Diana', 'd@test.com', 28)");
      expect(result.rowCount).toBe(1);
    });

    it('handles NULL values', async () => {
      const result = await driver.execute(conn, 'SELECT * FROM users WHERE id = 3');
      expect(result.rows[0]!.email).toBeNull();
    });
  });

  describe('stream', () => {
    it('yields all rows', async () => {
      const rows: Record<string, unknown>[] = [];
      for await (const row of driver.stream(conn, 'SELECT * FROM users ORDER BY id')) {
        rows.push(row);
      }
      expect(rows).toHaveLength(3);
      expect(rows[0]!.name).toBe('Alice');
    });
  });

  describe('introspection', () => {
    it('getSchemas returns main', async () => {
      const schemas = await driver.getSchemas(conn);
      expect(schemas).toEqual([{ name: 'main' }]);
    });

    it('getTables lists user tables', async () => {
      const tables = await driver.getTables(conn);
      expect(tables).toHaveLength(1);
      expect(tables[0]!.name).toBe('users');
      expect(tables[0]!.type).toBe('table');
    });

    it('getColumns lists columns with types', async () => {
      const cols = await driver.getColumns(conn, 'main', 'users');
      expect(cols).toHaveLength(4);
      const idCol = cols.find(c => c.name === 'id')!;
      expect(idCol.isPrimaryKey).toBe(true);
      expect(idCol.type).toBe('integer');
      const nameCol = cols.find(c => c.name === 'name')!;
      expect(nameCol.nullable).toBe(false);
    });
  });

  describe('explain', () => {
    it('returns a plan with warnings for full scans', async () => {
      const plan = await driver.explain(conn, 'SELECT * FROM users');
      expect(plan.dialect).toBe('sqlite');
      expect(plan.plan.operation).toBe('Query Plan');
      expect(plan.plan.children.length).toBeGreaterThan(0);
      expect(plan.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('transactions', () => {
    it('commits successfully', async () => {
      const tx = await driver.beginTransaction(conn);
      await tx.query("INSERT INTO users VALUES (10, 'Tx User', 'tx@test.com', 40)");
      await tx.commit();
      const result = await driver.execute(conn, 'SELECT * FROM users WHERE id = 10');
      expect(result.rowCount).toBe(1);
    });

    it('rolls back on request', async () => {
      const tx = await driver.beginTransaction(conn);
      await tx.query("INSERT INTO users VALUES (11, 'Rollback', 'rb@test.com', 50)");
      await tx.rollback();
      const result = await driver.execute(conn, 'SELECT * FROM users WHERE id = 11');
      expect(result.rowCount).toBe(0);
    });
  });

  describe('capabilities', () => {
    it('reports correct capabilities', () => {
      const caps = driver.capabilities();
      expect(caps.embedded).toBe(true);
      expect(caps.transactions).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.roles).toBe(false);
      expect(caps.listenNotify).toBe(false);
    });
  });

  describe('mapNativeType', () => {
    it('maps SQLite types correctly', () => {
      expect(driver.mapNativeType('INTEGER')).toBe('integer');
      expect(driver.mapNativeType('TEXT')).toBe('string');
      expect(driver.mapNativeType('REAL')).toBe('float');
      expect(driver.mapNativeType('BLOB')).toBe('binary');
      expect(driver.mapNativeType('BOOLEAN')).toBe('boolean');
      expect(driver.mapNativeType('VARCHAR(255)')).toBe('string');
      expect(driver.mapNativeType('DATETIME')).toBe('datetime');
      expect(driver.mapNativeType('JSON')).toBe('json');
    });
  });
});
