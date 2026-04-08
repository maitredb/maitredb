import { afterEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import type { Connection } from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';
import { PostgresDriver } from '../index.js';

type MockQueryResult = {
  rows: Record<string, unknown>[];
  rowCount?: number;
  fields?: Array<{ name: string; dataTypeID: number }>;
};

class MockClient {
  readonly queryCalls: Array<{ sql: string; params?: unknown[] }> = [];
  readonly release = vi.fn(() => {});

  constructor(private readonly runQuery: (sql: string, params?: unknown[]) => Promise<MockQueryResult>) {}

  async query(sql: string, params?: unknown[]): Promise<MockQueryResult> {
    this.queryCalls.push({ sql, params });
    return this.runQuery(sql, params);
  }
}

class MockPool {
  lastClient: MockClient | undefined;
  readonly query: ReturnType<typeof vi.fn>;
  readonly connect: ReturnType<typeof vi.fn>;
  readonly end = vi.fn(async () => {});

  constructor(private readonly runQuery: (sql: string, params?: unknown[]) => Promise<MockQueryResult>) {
    this.query = vi.fn(async (sql: string, params?: unknown[]) => this.runQuery(sql, params));
    this.connect = vi.fn(async () => {
      this.lastClient = new MockClient(this.runQuery);
      return this.lastClient;
    });
  }
}

function asConnection(pool: MockPool): Connection {
  return {
    id: 'conn-1',
    dialect: 'postgresql',
    config: { name: 'pg', type: 'postgresql' },
    native: pool as unknown,
  };
}

describe('PostgresDriver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses pg pool lifecycle for connect/testConnection/disconnect', async () => {
    const querySpy = vi.spyOn(Pool.prototype, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('version()')) {
        return {
          rows: [{ version: 'PostgreSQL 16.3' }],
          rowCount: 1,
          fields: [],
        } as never;
      }

      return {
        rows: [],
        rowCount: 0,
        fields: [],
      } as never;
    });
    const endSpy = vi.spyOn(Pool.prototype, 'end').mockResolvedValue(undefined);

    const driver = new PostgresDriver();
    const config = { name: 'pg-main', type: 'postgresql' as const, host: 'localhost', database: 'app' };

    const conn = await driver.connect(config);
    expect(conn.dialect).toBe('postgresql');
    expect(conn.config).toEqual(config);
    expect(querySpy).toHaveBeenCalledWith('SELECT 1');

    const test = await driver.testConnection(config);
    expect(test.success).toBe(true);
    expect(test.serverVersion).toBe('PostgreSQL 16.3');
    expect(test.latencyMs).toBeGreaterThanOrEqual(0);
    expect(querySpy).toHaveBeenCalledWith('SELECT version() AS version');

    await driver.disconnect(conn);
    expect(endSpy).toHaveBeenCalledTimes(2);
  });

  it('returns testConnection failure details when pg query fails', async () => {
    vi.spyOn(Pool.prototype, 'query').mockRejectedValue(new Error('network down'));
    const endSpy = vi.spyOn(Pool.prototype, 'end').mockResolvedValue(undefined);

    const driver = new PostgresDriver();
    const result = await driver.testConnection({ name: 'pg-main', type: 'postgresql' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('network down');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it('reports expected capabilities', () => {
    const driver = new PostgresDriver();
    expect(driver.capabilities()).toMatchObject({
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: true,
      roles: true,
      schemas: true,
      cancelQuery: true,
      listenNotify: true,
      asyncExecution: false,
      embedded: false,
      costEstimate: true,
    });
  });

  it('maps PostgreSQL native types into maitre types', () => {
    const driver = new PostgresDriver();

    expect(driver.mapNativeType('integer')).toBe('integer');
    expect(driver.mapNativeType('double precision')).toBe('float');
    expect(driver.mapNativeType('numeric')).toBe('decimal');
    expect(driver.mapNativeType('boolean')).toBe('boolean');
    expect(driver.mapNativeType('timestamp with time zone')).toBe('timestamp');
    expect(driver.mapNativeType('date')).toBe('date');
    expect(driver.mapNativeType('time without time zone')).toBe('time');
    expect(driver.mapNativeType('jsonb')).toBe('json');
    expect(driver.mapNativeType('uuid')).toBe('uuid');
    expect(driver.mapNativeType('interval')).toBe('interval');
    expect(driver.mapNativeType('geometry')).toBe('geometry');
    expect(driver.mapNativeType('_text')).toBe('array');
    expect(driver.mapNativeType('text')).toBe('string');
    expect(driver.mapNativeType('custom_type')).toBe('unknown');
  });

  it('execute returns rows/fields with required shared fields and forwards params', async () => {
    const driver = new PostgresDriver();
    const pool = new MockPool(async () => ({
      rows: [{ id: BigInt(42), name: 'Ada', payload: Buffer.from('aa', 'hex') }],
      rowCount: 1,
      fields: [
        { name: 'id', dataTypeID: 20 },
        { name: 'name', dataTypeID: 25 },
        { name: 'payload', dataTypeID: 17 },
      ],
    }));

    const result = await driver.execute(
      asConnection(pool),
      'SELECT id, name, payload FROM users WHERE id = $1',
      [42],
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows[0]).toEqual({ id: '42', name: 'Ada', payload: 'aa' });
    expect(result.fields).toEqual([
      { name: 'id', nativeType: 'bigint', type: 'integer' },
      { name: 'name', nativeType: 'text', type: 'string' },
      { name: 'payload', nativeType: 'bytea', type: 'binary' },
    ]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(pool.query).toHaveBeenCalledWith('SELECT id, name, payload FROM users WHERE id = $1', [42]);
  });

  it('streams mapped rows', async () => {
    const driver = new PostgresDriver();
    const pool = new MockPool(async () => ({
      rows: [{ id: BigInt(1) }, { id: BigInt(2) }],
      rowCount: 2,
      fields: [],
    }));

    const rows: Record<string, unknown>[] = [];
    for await (const row of driver.stream(asConnection(pool), 'SELECT id FROM users WHERE id > $1', [0])) {
      rows.push(row);
    }

    expect(rows).toEqual([{ id: '1' }, { id: '2' }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT id FROM users WHERE id > $1', [0]);
  });

  it('validateConnection reports true on success and false on probe failure', async () => {
    const driver = new PostgresDriver();
    const good = new MockPool(async () => ({ rows: [], rowCount: 0, fields: [] }));
    const bad = new MockPool(async () => {
      throw new Error('lost connection');
    });

    await expect(driver.validateConnection(asConnection(good))).resolves.toBe(true);
    await expect(driver.validateConnection(asConnection(bad))).resolves.toBe(false);
  });

  it('cancelQuery sends pg_cancel_backend and validates query ids', async () => {
    const driver = new PostgresDriver();
    const pool = new MockPool(async () => ({ rows: [], rowCount: 0, fields: [] }));
    const conn = asConnection(pool);

    await driver.cancelQuery(conn, '321');
    expect(pool.query).toHaveBeenCalledWith('SELECT pg_cancel_backend($1)', [321]);

    await expect(driver.cancelQuery(conn, 'abc')).rejects.toMatchObject({
      code: MaitreErrorCode.CONFIG_ERROR,
    });
  });

  it('beginTransaction applies options and returns required query result fields', async () => {
    const driver = new PostgresDriver();
    const calls: string[] = [];
    const pool = new MockPool(async (sql: string) => {
      calls.push(sql);
      if (sql.startsWith('SELECT')) {
        return {
          rows: [{ id: BigInt(9), payload: Buffer.from('ff', 'hex') }],
          rowCount: 1,
          fields: [
            { name: 'id', dataTypeID: 20 },
            { name: 'payload', dataTypeID: 17 },
          ],
        };
      }

      return { rows: [], rowCount: 0, fields: [] };
    });

    const tx = await driver.beginTransaction(asConnection(pool), {
      isolationLevel: 'serializable',
      readOnly: true,
    });
    const result = await tx.query('SELECT id, payload FROM users WHERE id = $1', [9]);
    await tx.commit();

    expect(calls).toEqual([
      'BEGIN',
      'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE',
      'SET TRANSACTION READ ONLY',
      'SELECT id, payload FROM users WHERE id = $1',
      'COMMIT',
    ]);
    expect(result).toMatchObject({
      rowCount: 1,
      rows: [{ id: '9', payload: 'ff' }],
      fields: [
        { name: 'id', nativeType: 'bigint', type: 'integer' },
        { name: 'payload', nativeType: 'bytea', type: 'binary' },
      ],
    });
    expect(pool.lastClient?.release).toHaveBeenCalledTimes(1);
  });

  it('releases transaction client on rollback', async () => {
    const driver = new PostgresDriver();
    const calls: string[] = [];
    const pool = new MockPool(async (sql: string) => {
      calls.push(sql);
      return { rows: [], rowCount: 0, fields: [] };
    });

    const tx = await driver.beginTransaction(asConnection(pool));
    await tx.rollback();

    expect(calls).toEqual(['BEGIN', 'ROLLBACK']);
    expect(pool.lastClient?.release).toHaveBeenCalledTimes(1);
  });

  it('maps table and view metadata with required schema/type fields', async () => {
    const driver = new PostgresDriver();
    const pool = new MockPool(async () => ({
      rows: [
        { schema_name: 'public', table_name: 'users', table_type: 'BASE TABLE', row_estimate: '12' },
        { schema_name: 'analytics', table_name: 'active_users', table_type: 'VIEW', row_estimate: null },
      ],
      rowCount: 2,
      fields: [],
    }));

    const tables = await driver.getTables(asConnection(pool));
    expect(tables).toEqual([
      { schema: 'public', name: 'users', type: 'table', rowCountEstimate: 12 },
      { schema: 'analytics', name: 'active_users', type: 'view', rowCountEstimate: undefined },
    ]);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('information_schema.tables'), [null]);
  });

  it('returns schema/table/column/index structures with required fields', async () => {
    const driver = new PostgresDriver();
    const pool = new MockPool(async (sql: string) => {
      if (sql.includes('WITH pk_columns')) {
        return {
          rows: [{
            column_name: 'id',
            native_type: 'int4',
            is_nullable: 'NO',
            column_default: "nextval('users_id_seq'::regclass)",
            is_primary_key: true,
            comment: 'Primary key',
          }],
          rowCount: 1,
          fields: [],
        };
      }

      if (sql.includes('information_schema.tables')) {
        return {
          rows: [{ schema_name: 'public', table_name: 'users', table_type: 'BASE TABLE', row_estimate: '12' }],
          rowCount: 1,
          fields: [],
        };
      }

      if (sql.includes('SELECT nspname AS name')) {
        return { rows: [{ name: 'public' }], rowCount: 1, fields: [] };
      }

      return {
        rows: [{ index_name: 'users_pkey', is_primary: true, is_unique: true, columns: ['id'] }],
        rowCount: 1,
        fields: [],
      };
    });

    const conn = asConnection(pool);
    const schemas = await driver.getSchemas(conn);
    const tables = await driver.getTables(conn, 'public');
    const columns = await driver.getColumns(conn, 'public', 'users');
    const indexes = await driver.getIndexes(conn, 'public', 'users');

    expect(schemas).toEqual([{ name: 'public' }]);
    expect(tables).toEqual([
      { schema: 'public', name: 'users', type: 'table', rowCountEstimate: 12 },
    ]);
    expect(columns).toEqual([
      {
        schema: 'public',
        table: 'users',
        name: 'id',
        nativeType: 'int4',
        type: 'integer',
        nullable: false,
        defaultValue: "nextval('users_id_seq'::regclass)",
        isPrimaryKey: true,
        comment: 'Primary key',
      },
    ]);
    expect(indexes).toEqual([
      {
        schema: 'public',
        table: 'users',
        name: 'users_pkey',
        columns: ['id'],
        unique: true,
        primary: true,
      },
    ]);
  });

  it('returns function/procedure/role/grant shapes with required fields', async () => {
    const driver = new PostgresDriver();
    const pool = new MockPool(async (sql: string) => {
      if (sql.includes("p.prokind = 'f'")) {
        return {
          rows: [{
            schema_name: 'public',
            name: 'f_users',
            return_type: 'integer',
            arguments: 'x integer',
            language: 'sql',
          }],
          rowCount: 1,
          fields: [],
        };
      }

      if (sql.includes("p.prokind = 'p'")) {
        return {
          rows: [{
            schema_name: 'public',
            name: 'p_users',
            arguments: 'x integer',
            language: 'plpgsql',
          }],
          rowCount: 1,
          fields: [],
        };
      }

      if (sql.includes('FROM pg_catalog.pg_roles')) {
        return {
          rows: [{ name: 'app_role', superuser: false, login: true }],
          rowCount: 1,
          fields: [],
        };
      }

      return {
        rows: [
          { role_name: 'app_role', schema_name: 'public', table_name: 'users', privilege_type: 'SELECT' },
          { role_name: 'app_role', schema_name: 'public', table_name: 'users', privilege_type: 'UPDATE' },
        ],
        rowCount: 2,
        fields: [],
      };
    });

    const conn = asConnection(pool);
    const functions = await driver.getFunctions(conn, 'public');
    const procedures = await driver.getProcedures(conn, 'public');
    const roles = await driver.getRoles(conn);
    const grants = await driver.getGrants(conn, 'app_role');

    expect(functions).toEqual([
      {
        schema: 'public',
        name: 'f_users',
        returnType: 'integer',
        arguments: 'x integer',
        language: 'sql',
      },
    ]);

    expect(procedures).toEqual([
      {
        schema: 'public',
        name: 'p_users',
        arguments: 'x integer',
        language: 'plpgsql',
      },
    ]);

    expect(roles).toEqual([{ name: 'app_role', superuser: false, login: true }]);
    expect(grants).toEqual([
      {
        role: 'app_role',
        schema: 'public',
        table: 'users',
        privileges: ['SELECT', 'UPDATE'],
      },
    ]);
  });

  it('normalizes EXPLAIN output for json and text formats with analyze metrics', async () => {
    const driver = new PostgresDriver();
    const pool = new MockPool(async (sql: string) => {
      if (sql.includes('FORMAT JSON')) {
        return {
          rows: [{
            'QUERY PLAN': [
              {
                Plan: {
                  'Node Type': 'Seq Scan',
                  'Relation Name': 'users',
                  'Startup Cost': 0,
                  'Total Cost': 10,
                  'Plan Rows': 12,
                  'Actual Rows': 3,
                  'Actual Total Time': 0.72,
                },
              },
            ],
          }],
          rowCount: 1,
          fields: [],
        };
      }

      return {
        rows: [{ 'QUERY PLAN': 'Seq Scan on users' }],
        rowCount: 1,
        fields: [],
      };
    });

    const conn = asConnection(pool);

    const jsonExplain = await driver.explain(conn, 'SELECT * FROM users', { format: 'json', analyze: true });
    expect(jsonExplain.plan.operation).toBe('Seq Scan');
    expect(jsonExplain.rowsEstimated).toBe(12);
    expect(jsonExplain.rowsActual).toBe(3);
    expect(jsonExplain.totalTimeMs).toBe(0.72);
    expect(jsonExplain.warnings).toContain('Sequential scan on users');
    expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('ANALYZE, FORMAT JSON'));

    const textExplain = await driver.explain(conn, 'SELECT * FROM users', { format: 'text' });
    expect(textExplain.plan.operation).toBe('EXPLAIN');
    expect(textExplain.warnings[0]).toContain('Sequential scan detected');
    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('FORMAT TEXT'));
  });

  it('throws a typed error for invalid connection handles', async () => {
    const driver = new PostgresDriver();

    await expect(driver.execute({
      id: 'bad',
      dialect: 'postgresql',
      config: { name: 'bad', type: 'postgresql' },
      native: {},
    }, 'SELECT 1')).rejects.toBeInstanceOf(MaitreError);
  });
});
