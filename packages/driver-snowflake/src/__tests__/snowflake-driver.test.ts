import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnowflakeDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Mock snowflake-sdk — all tests run without a real Snowflake account
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();
const mockConnect = vi.fn();
const mockDestroy = vi.fn();

const mockSfConnection = {
  connect: mockConnect,
  execute: mockExecute,
  destroy: mockDestroy,
};

vi.mock('snowflake-sdk', () => ({
  default: {
    createConnection: vi.fn(() => mockSfConnection),
  },
  createConnection: vi.fn(() => mockSfConnection),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  name: 'test-sf',
  type: 'snowflake' as const,
  host: 'xy12345.snowflakecomputing.com',
  user: 'testuser',
  password: 'testpass',
  database: 'TESTDB',
  schema: 'PUBLIC',
  options: { account: 'xy12345.us-east-1' },
};

function makeRows(rows: Record<string, unknown>[]) {
  mockExecute.mockImplementation(({ complete }) => {
    complete(null, {}, rows);
  });
}

function makeStreamRows(rows: Record<string, unknown>[]) {
  mockExecute.mockImplementation(({ complete }) => {
    complete(null, { streamRows: () => Readable.from(rows) }, undefined);
  });
}

function makeConn(): Connection {
  return { id: 'test-id', config: BASE_CONFIG, dialect: 'snowflake', native: mockSfConnection };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SnowflakeDriver', () => {
  let driver: SnowflakeDriver;

  beforeEach(() => {
    driver = new SnowflakeDriver();
    vi.clearAllMocks();
    // Default: connect succeeds
    mockConnect.mockImplementation((cb: (err: null, conn: typeof mockSfConnection) => void) =>
      cb(null, mockSfConnection),
    );
    // Default: destroy succeeds
    mockDestroy.mockImplementation((cb: (err: null) => void) => cb(null));
  });

  // --- capabilities ---

  it('capabilities() reports correct flags', () => {
    const caps = driver.capabilities();
    expect(caps.transactions).toBe(true);
    expect(caps.streaming).toBe(true);
    expect(caps.roles).toBe(true);
    expect(caps.schemas).toBe(true);
    expect(caps.arrowNative).toBe(false);
    expect(caps.costEstimate).toBe(true);
  });

  it('dialect is snowflake', () => {
    expect(driver.dialect).toBe('snowflake');
  });

  // --- connect ---

  it('connect() throws if account is missing', async () => {
    await expect(
      driver.connect({ name: 'no-account', type: 'snowflake' }),
    ).rejects.toThrow('options.account');
  });

  it('connect() succeeds with password auth', async () => {
    const conn = await driver.connect(BASE_CONFIG);
    expect(conn.dialect).toBe('snowflake');
    expect(mockConnect).toHaveBeenCalled();
  });

  it('connect() prefers key-pair auth when privateKey is set', async () => {
    const { createConnection } = await import('snowflake-sdk');
    await driver.connect({
      ...BASE_CONFIG,
      auth: ['key-pair', 'password'],
      options: { account: 'xy12345', privateKey: 'MOCK_KEY' },
    });
    expect(createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ authenticator: 'SNOWFLAKE_JWT', privateKey: 'MOCK_KEY' }),
    );
  });

  it('connect() uses token auth when token-cache method is listed', async () => {
    const { createConnection } = await import('snowflake-sdk');
    await driver.connect({
      ...BASE_CONFIG,
      auth: ['token-cache'],
      options: { account: 'xy12345', token: 'MY_TOKEN' },
    });
    expect(createConnection).toHaveBeenCalledWith(
      expect.objectContaining({ authenticator: 'OAUTH', token: 'MY_TOKEN' }),
    );
  });

  it('connect() propagates connection errors', async () => {
    mockConnect.mockImplementation((cb: (err: Error) => void) => cb(new Error('Auth failed')));
    await expect(driver.connect(BASE_CONFIG)).rejects.toThrow('Auth failed');
  });

  // --- disconnect ---

  it('disconnect() calls destroy()', async () => {
    await driver.disconnect(makeConn());
    expect(mockDestroy).toHaveBeenCalled();
  });

  // --- validateConnection ---

  it('validateConnection() returns true on SELECT 1', async () => {
    makeRows([{ '1': 1 }]);
    expect(await driver.validateConnection(makeConn())).toBe(true);
  });

  it('validateConnection() returns false on error', async () => {
    mockExecute.mockImplementation(({ complete }: { complete: (err: Error) => void }) =>
      complete(new Error('connection lost')),
    );
    expect(await driver.validateConnection(makeConn())).toBe(false);
  });

  // --- execute ---

  it('execute() SELECT returns batch with data and empty rows', async () => {
    makeRows([{ ID: 1, NAME: 'Alice' }]);
    const result = await driver.execute(makeConn(), 'SELECT ID, NAME FROM USERS');
    expect(result.rows).toHaveLength(0);
    expect(result.batch).toBeDefined();
    expect(result.rowCount).toBe(1);
  });

  it('execute() INSERT returns rowCount and empty rows', async () => {
    makeRows([]);
    const result = await driver.execute(makeConn(), 'INSERT INTO t VALUES (1)');
    expect(result.rows).toHaveLength(0);
    expect(result.rowCount).toBe(0);
  });

  it('execute() CREATE returns rowCount 0', async () => {
    makeRows([]);
    const result = await driver.execute(makeConn(), 'CREATE TABLE t (id INT)');
    expect(result.rowCount).toBe(0);
  });

  // --- stream ---

  it('stream() yields rows from the Snowflake streaming API', async () => {
    makeStreamRows([{ X: 1 }, { X: 2 }]);
    const rows: Record<string, unknown>[] = [];
    for await (const row of driver.stream(makeConn(), 'SELECT X FROM T')) {
      rows.push(row);
    }
    expect(rows).toHaveLength(2);
    expect(mockExecute).toHaveBeenCalledWith(expect.objectContaining({ streamResult: true }));
  });

  // --- transactions ---

  it('beginTransaction() issues BEGIN and returns commit/rollback', async () => {
    // Each call to execute goes through mockExecute
    mockExecute.mockImplementation(({ sqlText, complete }: { sqlText: string; complete: (err: null, stmt: object, rows: unknown[]) => void }) => {
      complete(null, {}, []);
    });

    const txn = await driver.beginTransaction(makeConn());
    expect(txn.id).toBeDefined();

    await txn.commit();
    await txn.rollback();

    // BEGIN, COMMIT, ROLLBACK should have been called
    const calls = mockExecute.mock.calls.map(c => (c[0] as { sqlText: string }).sqlText);
    expect(calls).toContain('BEGIN');
    expect(calls).toContain('COMMIT');
    expect(calls).toContain('ROLLBACK');
  });

  // --- introspection ---

  it('getSchemas() maps SHOW SCHEMAS output', async () => {
    makeRows([{ name: 'PUBLIC' }, { name: 'ANALYTICS' }]);
    const schemas = await driver.getSchemas(makeConn());
    expect(schemas).toEqual([{ name: 'PUBLIC' }, { name: 'ANALYTICS' }]);
  });

  it('getTables() returns tables and views', async () => {
    // First call: SHOW TABLES, second call: SHOW VIEWS
    mockExecute
      .mockImplementationOnce(({ complete }: { complete: (err: null, stmt: object, rows: Record<string, unknown>[]) => void }) =>
        complete(null, {}, [{ name: 'ORDERS', schema_name: 'PUBLIC' }]),
      )
      .mockImplementationOnce(({ complete }: { complete: (err: null, stmt: object, rows: Record<string, unknown>[]) => void }) =>
        complete(null, {}, [{ name: 'ORDERS_VIEW', schema_name: 'PUBLIC' }]),
      );

    const tables = await driver.getTables(makeConn(), 'PUBLIC');
    expect(tables).toHaveLength(2);
    expect(tables[0]).toMatchObject({ name: 'ORDERS', type: 'table' });
    expect(tables[1]).toMatchObject({ name: 'ORDERS_VIEW', type: 'view' });
  });

  it('getColumns() maps INFORMATION_SCHEMA.COLUMNS output', async () => {
    makeRows([{
      COLUMN_NAME: 'ID',
      DATA_TYPE: 'NUMBER',
      IS_NULLABLE: 'NO',
      COLUMN_DEFAULT: null,
      COMMENT: null,
    }]);
    const cols = await driver.getColumns(makeConn(), 'PUBLIC', 'ORDERS');
    expect(cols).toHaveLength(1);
    expect(cols[0]).toMatchObject({ name: 'ID', type: 'decimal', nullable: false });
  });

  it('getIndexes() returns primary key from SHOW PRIMARY KEYS', async () => {
    makeRows([{ column_name: 'ID' }]);
    const indexes = await driver.getIndexes(makeConn(), 'PUBLIC', 'ORDERS');
    expect(indexes).toHaveLength(1);
    expect(indexes[0]).toMatchObject({ name: 'PRIMARY', primary: true, columns: ['ID'] });
  });

  it('getIndexes() returns empty array when no primary keys', async () => {
    makeRows([]);
    const indexes = await driver.getIndexes(makeConn(), 'PUBLIC', 'ORDERS');
    expect(indexes).toHaveLength(0);
  });

  it('getRoles() maps SHOW ROLES output', async () => {
    makeRows([{ name: 'SYSADMIN' }, { name: 'ANALYST' }]);
    const roles = await driver.getRoles(makeConn());
    expect(roles).toHaveLength(2);
    expect(roles[0]!.name).toBe('SYSADMIN');
  });

  // --- explain ---

  it('explain() calls EXPLAIN and returns plan', async () => {
    makeRows([{ operation: 'TableScan', objectName: 'ORDERS' }]);
    const result = await driver.explain(makeConn(), 'SELECT * FROM ORDERS');
    expect(result.dialect).toBe('snowflake');
    expect(result.plan.children.length).toBeGreaterThan(0);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ sqlText: expect.stringContaining('EXPLAIN') }),
    );
  });

  // --- mapNativeType ---

  it('mapNativeType() covers all categories', () => {
    expect(driver.mapNativeType('VARCHAR')).toBe('string');
    expect(driver.mapNativeType('NUMBER')).toBe('decimal');
    expect(driver.mapNativeType('INTEGER')).toBe('integer');
    expect(driver.mapNativeType('FLOAT')).toBe('float');
    expect(driver.mapNativeType('BOOLEAN')).toBe('boolean');
    expect(driver.mapNativeType('DATE')).toBe('date');
    expect(driver.mapNativeType('TIME')).toBe('time');
    expect(driver.mapNativeType('TIMESTAMP_LTZ')).toBe('timestamp');
    expect(driver.mapNativeType('VARIANT')).toBe('json');
    expect(driver.mapNativeType('BINARY')).toBe('binary');
    expect(driver.mapNativeType('GEOGRAPHY')).toBe('geometry');
    expect(driver.mapNativeType('CUSTOM_TYPE')).toBe('unknown');
  });
});
