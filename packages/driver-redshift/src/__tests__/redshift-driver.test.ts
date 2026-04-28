import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedshiftDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Mock @aws-sdk/client-redshift-data
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockDestroy = vi.fn();

const mockClient = {
  send: mockSend,
  destroy: mockDestroy,
};

vi.mock('@aws-sdk/client-redshift-data', () => ({
  RedshiftDataClient: vi.fn(() => mockClient),
  ExecuteStatementCommand: vi.fn(p => ({ _type: 'ExecuteStatementCommand', ...p })),
  DescribeStatementCommand: vi.fn(p => ({ _type: 'DescribeStatementCommand', ...p })),
  GetStatementResultCommand: vi.fn(p => ({ _type: 'GetStatementResultCommand', ...p })),
  CancelStatementCommand: vi.fn(p => ({ _type: 'CancelStatementCommand', ...p })),
  ListSchemasCommand: vi.fn(p => ({ _type: 'ListSchemasCommand', ...p })),
  ListTablesCommand: vi.fn(p => ({ _type: 'ListTablesCommand', ...p })),
  DescribeTableCommand: vi.fn(p => ({ _type: 'DescribeTableCommand', ...p })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  name: 'test-rs',
  type: 'redshift' as const,
  database: 'dev',
  options: {
    clusterIdentifier: 'my-cluster',
    region: 'us-east-1',
    dbUser: 'admin',
  },
};

function makeConn(): Connection {
  return {
    id: 'test-id',
    config: BASE_CONFIG,
    dialect: 'redshift',
    native: {
      client: mockClient,
      opts: BASE_CONFIG.options,
      database: 'dev',
    },
  };
}

/** Set up mock for a successful statement execution with rows. */
function mockSuccessfulStatement(rows: Array<Record<string, unknown>>, columns: Array<{ name: string; typeName: string }>) {
  let callCount = 0;
  mockSend.mockImplementation((cmd: { _type: string }) => {
    if (cmd._type === 'ExecuteStatementCommand') return Promise.resolve({ Id: 'stmt-123' });
    if (cmd._type === 'DescribeStatementCommand') return Promise.resolve({ Status: 'FINISHED' });
    if (cmd._type === 'GetStatementResultCommand') {
      if (callCount++ === 0) {
        return Promise.resolve({
          ColumnMetadata: columns,
          Records: rows.map(row =>
            columns.map(c => {
              const v = row[c.name];
              if (v === null || v === undefined) return { isNull: true };
              if (typeof v === 'string') return { stringValue: v };
              if (typeof v === 'number') {
                if (Number.isInteger(v)) return { longValue: v };
                return { doubleValue: v };
              }
              if (typeof v === 'boolean') return { booleanValue: v };
              return { stringValue: String(v) };
            }),
          ),
          NextToken: undefined,
        });
      }
      return Promise.resolve({ Records: [], NextToken: undefined });
    }
    return Promise.resolve({});
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RedshiftDriver', () => {
  let driver: RedshiftDriver;

  beforeEach(() => {
    driver = new RedshiftDriver();
    vi.clearAllMocks();
    mockDestroy.mockReturnValue(undefined);
  });

  // --- capabilities ---

  it('capabilities() reports correct flags', () => {
    const caps = driver.capabilities();
    expect(caps.transactions).toBe(false);
    expect(caps.streaming).toBe(true);
    expect(caps.asyncExecution).toBe(true);
    expect(caps.cancelQuery).toBe(true);
    expect(caps.roles).toBe(true);
    expect(caps.arrowNative).toBe(false);
  });

  it('dialect is redshift', () => {
    expect(driver.dialect).toBe('redshift');
  });

  // --- connect ---

  it('connect() throws without clusterIdentifier or workgroupName', async () => {
    await expect(driver.connect({ name: 'x', type: 'redshift' })).rejects.toThrow(
      'clusterIdentifier',
    );
  });

  it('connect() creates RedshiftDataClient with region', async () => {
    const { RedshiftDataClient } = await import('@aws-sdk/client-redshift-data');
    const conn = await driver.connect(BASE_CONFIG);
    expect(RedshiftDataClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
    expect(conn.dialect).toBe('redshift');
  });

  it('connect() works with workgroupName (Serverless)', async () => {
    const conn = await driver.connect({
      name: 'serverless',
      type: 'redshift',
      options: { workgroupName: 'my-workgroup', region: 'us-west-2', outputLocation: '' },
    });
    expect(conn.dialect).toBe('redshift');
  });

  // --- disconnect ---

  it('disconnect() calls client.destroy()', async () => {
    await driver.disconnect(makeConn());
    expect(mockDestroy).toHaveBeenCalled();
  });

  // --- execute ---

  it('execute() SELECT polls, fetches results, and returns batch', async () => {
    mockSuccessfulStatement(
      [{ user_id: 1, name: 'Alice' }],
      [{ name: 'user_id', typeName: 'int4' }, { name: 'name', typeName: 'varchar' }],
    );
    const result = await driver.execute(makeConn(), 'SELECT user_id, name FROM users');
    expect(result.batch).toBeDefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows).toHaveLength(0);
    expect(result.fields[0]!.name).toBe('user_id');
    expect(result.fields[0]!.type).toBe('integer');
  });

  it('execute() DDL returns rowCount 0 without fetching results', async () => {
    mockSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'ExecuteStatementCommand') return Promise.resolve({ Id: 'stmt-456' });
      if (cmd._type === 'DescribeStatementCommand') return Promise.resolve({ Status: 'FINISHED' });
      return Promise.resolve({});
    });
    const result = await driver.execute(makeConn(), 'CREATE TABLE t (id INT)');
    expect(result.rowCount).toBe(0);
    expect(result.fields).toHaveLength(0);
  });

  it('execute() throws when statement fails', async () => {
    mockSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'ExecuteStatementCommand') return Promise.resolve({ Id: 'stmt-789' });
      if (cmd._type === 'DescribeStatementCommand') return Promise.resolve({ Status: 'FAILED', Error: 'Table not found' });
      return Promise.resolve({});
    });
    await expect(driver.execute(makeConn(), 'SELECT * FROM missing')).rejects.toThrow('Table not found');
  });

  it('execute() propagates multi-page results', async () => {
    const cols = [{ name: 'id', typeName: 'int4' }];
    let pageCount = 0;
    mockSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'ExecuteStatementCommand') return Promise.resolve({ Id: 'stmt-mp' });
      if (cmd._type === 'DescribeStatementCommand') return Promise.resolve({ Status: 'FINISHED' });
      if (cmd._type === 'GetStatementResultCommand') {
        pageCount++;
        if (pageCount === 1) {
          return Promise.resolve({ ColumnMetadata: cols, Records: [[{ longValue: 1 }]], NextToken: 'tok1' });
        }
        return Promise.resolve({ Records: [[{ longValue: 2 }]], NextToken: undefined });
      }
      return Promise.resolve({});
    });
    const result = await driver.execute(makeConn(), 'SELECT id FROM t');
    expect(result.rowCount).toBe(2);
  });

  // --- cancelQuery ---

  it('cancelQuery() sends CancelStatementCommand', async () => {
    mockSend.mockResolvedValue({});
    await driver.cancelQuery(makeConn(), 'stmt-abc');
    const { CancelStatementCommand } = await import('@aws-sdk/client-redshift-data');
    expect(CancelStatementCommand).toHaveBeenCalledWith({ Id: 'stmt-abc' });
  });

  // --- transactions ---

  it('beginTransaction() throws (Data API limitation)', async () => {
    await expect(driver.beginTransaction(makeConn())).rejects.toThrow('transactions');
  });

  // --- introspection ---

  it('getSchemas() maps ListSchemasCommand', async () => {
    mockSend.mockResolvedValue({ Schemas: ['public', 'analytics'] });
    const schemas = await driver.getSchemas(makeConn());
    expect(schemas).toHaveLength(2);
    expect(schemas[0]!.name).toBe('public');
  });

  it('getTables() maps ListTablesCommand', async () => {
    mockSend.mockResolvedValue({
      Tables: [
        { schema: 'public', name: 'orders', type: 'TABLE' },
        { schema: 'public', name: 'orders_view', type: 'VIEW' },
      ],
    });
    const tables = await driver.getTables(makeConn(), 'public');
    expect(tables).toHaveLength(2);
    expect(tables[1]!.type).toBe('view');
  });

  it('getColumns() maps DescribeTableCommand', async () => {
    mockSend.mockResolvedValue({
      ColumnList: [
        { name: 'id', typeName: 'int4', notNull: true },
        { name: 'email', typeName: 'varchar', notNull: false },
      ],
    });
    const cols = await driver.getColumns(makeConn(), 'public', 'users');
    expect(cols).toHaveLength(2);
    expect(cols[0]).toMatchObject({ name: 'id', type: 'integer', nullable: false });
    expect(cols[1]).toMatchObject({ name: 'email', type: 'string', nullable: true });
  });

  // --- mapNativeType ---

  it('mapNativeType() covers all Redshift types', () => {
    expect(driver.mapNativeType('int4')).toBe('integer');
    expect(driver.mapNativeType('int8')).toBe('integer');
    expect(driver.mapNativeType('numeric')).toBe('decimal');
    expect(driver.mapNativeType('float8')).toBe('float');
    expect(driver.mapNativeType('boolean')).toBe('boolean');
    expect(driver.mapNativeType('varchar')).toBe('string');
    expect(driver.mapNativeType('text')).toBe('string');
    expect(driver.mapNativeType('date')).toBe('date');
    expect(driver.mapNativeType('timetz')).toBe('time');
    expect(driver.mapNativeType('timestamptz')).toBe('timestamp');
    expect(driver.mapNativeType('super')).toBe('json');
    expect(driver.mapNativeType('geometry')).toBe('geometry');
    expect(driver.mapNativeType('varbyte')).toBe('binary');
    expect(driver.mapNativeType('unknown_type')).toBe('unknown');
  });
});
