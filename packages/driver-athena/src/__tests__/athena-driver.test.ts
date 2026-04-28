import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AthenaDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Mock @aws-sdk/client-athena — all tests run without a real AWS account
// ---------------------------------------------------------------------------

const mockSend = vi.fn();
const mockDestroy = vi.fn();

const mockClient = {
  send: mockSend,
  destroy: mockDestroy,
};

vi.mock('@aws-sdk/client-athena', () => ({
  AthenaClient: vi.fn(() => mockClient),
  StartQueryExecutionCommand: vi.fn(p => ({ _type: 'StartQueryExecutionCommand', ...p })),
  GetQueryExecutionCommand: vi.fn(p => ({ _type: 'GetQueryExecutionCommand', ...p })),
  GetQueryResultsCommand: vi.fn(p => ({ _type: 'GetQueryResultsCommand', ...p })),
  StopQueryExecutionCommand: vi.fn(p => ({ _type: 'StopQueryExecutionCommand', ...p })),
  ListDatabasesCommand: vi.fn(p => ({ _type: 'ListDatabasesCommand', ...p })),
  ListTableMetadataCommand: vi.fn(p => ({ _type: 'ListTableMetadataCommand', ...p })),
  GetTableMetadataCommand: vi.fn(p => ({ _type: 'GetTableMetadataCommand', ...p })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  name: 'test-athena',
  type: 'athena' as const,
  database: 'analytics',
  options: {
    outputLocation: 's3://my-bucket/athena-results/',
    region: 'us-east-1',
    workGroup: 'primary',
    catalog: 'AwsDataCatalog',
  },
};

function makeConn(): Connection {
  return {
    id: 'test-id',
    config: BASE_CONFIG,
    dialect: 'athena',
    native: { client: mockClient, opts: BASE_CONFIG.options, database: 'analytics' },
  };
}

/**
 * Set up mock for a successful query execution with column data.
 */
function mockSuccessfulQuery(
  rows: Array<Record<string, unknown>>,
  columns: Array<{ Name: string; Type: string }>,
) {
  let getResultsCalled = false;
  mockSend.mockImplementation((cmd: { _type: string }) => {
    if (cmd._type === 'StartQueryExecutionCommand') {
      return Promise.resolve({ QueryExecutionId: 'qid-123' });
    }
    if (cmd._type === 'GetQueryExecutionCommand') {
      return Promise.resolve({
        QueryExecution: { Status: { State: 'SUCCEEDED' } },
      });
    }
    if (cmd._type === 'GetQueryResultsCommand') {
      if (!getResultsCalled) {
        getResultsCalled = true;
        // First row is the header row (matching column names)
        const headerRow = { Data: columns.map(c => ({ VarCharValue: c.Name })) };
        const dataRows = rows.map(row => ({
          Data: columns.map(c => ({
            VarCharValue: row[c.Name] !== undefined ? String(row[c.Name]) : undefined,
          })),
        }));
        return Promise.resolve({
          ResultSet: {
            ResultSetMetadata: { ColumnInfo: columns },
            Rows: [headerRow, ...dataRows],
          },
          NextToken: undefined,
        });
      }
      return Promise.resolve({ ResultSet: { Rows: [] }, NextToken: undefined });
    }
    return Promise.resolve({});
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AthenaDriver', () => {
  let driver: AthenaDriver;

  beforeEach(() => {
    driver = new AthenaDriver();
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
    expect(caps.roles).toBe(false);
    expect(caps.arrowNative).toBe(false);
  });

  it('dialect is athena', () => {
    expect(driver.dialect).toBe('athena');
  });

  // --- connect ---

  it('connect() throws without outputLocation', async () => {
    await expect(driver.connect({ name: 'x', type: 'athena' })).rejects.toThrow('outputLocation');
  });

  it('connect() creates AthenaClient with region', async () => {
    const { AthenaClient } = await import('@aws-sdk/client-athena');
    await driver.connect(BASE_CONFIG);
    expect(AthenaClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });

  // --- disconnect ---

  it('disconnect() calls client.destroy()', async () => {
    await driver.disconnect(makeConn());
    expect(mockDestroy).toHaveBeenCalled();
  });

  // --- execute ---

  it('execute() SELECT polls job and returns batch with typed fields', async () => {
    mockSuccessfulQuery(
      [{ user_id: '1', name: 'Alice' }],
      [{ Name: 'user_id', Type: 'integer' }, { Name: 'name', Type: 'varchar' }],
    );
    const result = await driver.execute(makeConn(), 'SELECT user_id, name FROM users');
    expect(result.batch).toBeDefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows).toHaveLength(0);
    expect(result.fields[0]!.name).toBe('user_id');
    expect(result.fields[0]!.type).toBe('integer');
    expect(result.fields[1]!.type).toBe('string');
  });

  it('execute() returns empty result when query produces no rows', async () => {
    mockSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'StartQueryExecutionCommand') return Promise.resolve({ QueryExecutionId: 'qid-empty' });
      if (cmd._type === 'GetQueryExecutionCommand') return Promise.resolve({ QueryExecution: { Status: { State: 'SUCCEEDED' } } });
      if (cmd._type === 'GetQueryResultsCommand') return Promise.resolve({ ResultSet: { ResultSetMetadata: { ColumnInfo: [] }, Rows: [] }, NextToken: undefined });
      return Promise.resolve({});
    });
    const result = await driver.execute(makeConn(), 'CREATE TABLE t (id INT)');
    expect(result.rowCount).toBe(0);
  });

  it('execute() throws when query fails', async () => {
    mockSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'StartQueryExecutionCommand') return Promise.resolve({ QueryExecutionId: 'qid-fail' });
      if (cmd._type === 'GetQueryExecutionCommand') {
        return Promise.resolve({
          QueryExecution: { Status: { State: 'FAILED', StateChangeReason: 'Table not found' } },
        });
      }
      return Promise.resolve({});
    });
    await expect(driver.execute(makeConn(), 'SELECT * FROM missing')).rejects.toThrow('Table not found');
  });

  it('execute() handles CANCELLED state', async () => {
    mockSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'StartQueryExecutionCommand') return Promise.resolve({ QueryExecutionId: 'qid-cancelled' });
      if (cmd._type === 'GetQueryExecutionCommand') {
        return Promise.resolve({
          QueryExecution: { Status: { State: 'CANCELLED', StateChangeReason: 'User cancelled' } },
        });
      }
      return Promise.resolve({});
    });
    await expect(driver.execute(makeConn(), 'SELECT 1')).rejects.toThrow('CANCELLED');
  });

  it('execute() pages through NextToken for large result sets', async () => {
    const cols = [{ Name: 'id', Type: 'integer' }];
    let page = 0;
    mockSend.mockImplementation((cmd: { _type: string }) => {
      if (cmd._type === 'StartQueryExecutionCommand') return Promise.resolve({ QueryExecutionId: 'qid-pages' });
      if (cmd._type === 'GetQueryExecutionCommand') return Promise.resolve({ QueryExecution: { Status: { State: 'SUCCEEDED' } } });
      if (cmd._type === 'GetQueryResultsCommand') {
        page++;
        if (page === 1) {
          const headerRow = { Data: [{ VarCharValue: 'id' }] };
          return Promise.resolve({
            ResultSet: { ResultSetMetadata: { ColumnInfo: cols }, Rows: [headerRow, { Data: [{ VarCharValue: '1' }] }] },
            NextToken: 'tok1',
          });
        }
        return Promise.resolve({
          ResultSet: { Rows: [{ Data: [{ VarCharValue: '2' }] }] },
          NextToken: undefined,
        });
      }
      return Promise.resolve({});
    });
    const result = await driver.execute(makeConn(), 'SELECT id FROM t');
    expect(result.rowCount).toBe(2);
  });

  // --- stream ---

  it('stream() yields rows from execute()', async () => {
    mockSuccessfulQuery([{ x: '1' }, { x: '2' }], [{ Name: 'x', Type: 'integer' }]);
    const rows: Record<string, unknown>[] = [];
    for await (const row of driver.stream(makeConn(), 'SELECT x FROM t')) {
      rows.push(row);
    }
    expect(rows).toHaveLength(2);
  });

  // --- cancelQuery ---

  it('cancelQuery() sends StopQueryExecutionCommand', async () => {
    mockSend.mockResolvedValue({});
    await driver.cancelQuery(makeConn(), 'qid-abc');
    const { StopQueryExecutionCommand } = await import('@aws-sdk/client-athena');
    expect(StopQueryExecutionCommand).toHaveBeenCalledWith({ QueryExecutionId: 'qid-abc' });
  });

  // --- transactions ---

  it('beginTransaction() throws (not supported)', async () => {
    await expect(driver.beginTransaction(makeConn())).rejects.toThrow('transactions');
  });

  // --- introspection ---

  it('getSchemas() maps ListDatabasesCommand', async () => {
    mockSend.mockResolvedValue({
      DatabaseList: [{ Name: 'analytics' }, { Name: 'raw' }],
    });
    const schemas = await driver.getSchemas(makeConn());
    expect(schemas).toHaveLength(2);
    expect(schemas[0]!.name).toBe('analytics');
    const { ListDatabasesCommand } = await import('@aws-sdk/client-athena');
    expect(ListDatabasesCommand).toHaveBeenCalledWith(
      expect.objectContaining({ CatalogName: 'AwsDataCatalog' }),
    );
  });

  it('getTables() maps ListTableMetadataCommand', async () => {
    mockSend.mockResolvedValue({
      TableMetadataList: [
        { Name: 'orders', TableType: 'EXTERNAL_TABLE' },
        { Name: 'orders_view', TableType: 'VIRTUAL_VIEW' },
      ],
    });
    const tables = await driver.getTables(makeConn(), 'analytics');
    expect(tables).toHaveLength(2);
    expect(tables[0]!.type).toBe('table');
    expect(tables[1]!.type).toBe('view');
  });

  it('getColumns() maps GetTableMetadataCommand', async () => {
    mockSend.mockResolvedValue({
      TableMetadata: {
        Columns: [
          { Name: 'id', Type: 'integer' },
          { Name: 'name', Type: 'varchar', Comment: 'User name' },
        ],
      },
    });
    const cols = await driver.getColumns(makeConn(), 'analytics', 'users');
    expect(cols).toHaveLength(2);
    expect(cols[0]).toMatchObject({ name: 'id', type: 'integer', nullable: true });
    expect(cols[1]).toMatchObject({ name: 'name', type: 'string', comment: 'User name' });
  });

  it('getIndexes() returns empty (Athena has no indexes)', async () => {
    const indexes = await driver.getIndexes(makeConn(), 'analytics', 'orders');
    expect(indexes).toHaveLength(0);
  });

  // --- explain ---

  it('explain() calls EXPLAIN and returns plan', async () => {
    mockSuccessfulQuery([{ 'Query Plan': 'Fragment 1\n  Output[user_id]' }], [{ Name: 'Query Plan', Type: 'varchar' }]);
    const result = await driver.explain(makeConn(), 'SELECT user_id FROM users');
    expect(result.dialect).toBe('athena');
    expect(result.rawPlan).toBeDefined();
  });

  // --- mapNativeType ---

  it('mapNativeType() covers all Athena/Presto types', () => {
    expect(driver.mapNativeType('integer')).toBe('integer');
    expect(driver.mapNativeType('bigint')).toBe('integer');
    expect(driver.mapNativeType('double')).toBe('float');
    expect(driver.mapNativeType('decimal')).toBe('decimal');
    expect(driver.mapNativeType('boolean')).toBe('boolean');
    expect(driver.mapNativeType('varchar')).toBe('string');
    expect(driver.mapNativeType('binary')).toBe('binary');
    expect(driver.mapNativeType('date')).toBe('date');
    expect(driver.mapNativeType('time')).toBe('time');
    expect(driver.mapNativeType('timestamp')).toBe('timestamp');
    expect(driver.mapNativeType('json')).toBe('json');
    expect(driver.mapNativeType('array<string>')).toBe('array');
    expect(driver.mapNativeType('map<string,int>')).toBe('json');
    expect(driver.mapNativeType('row(x int)')).toBe('json');
    expect(driver.mapNativeType('unknown_type')).toBe('unknown');
  });
});
