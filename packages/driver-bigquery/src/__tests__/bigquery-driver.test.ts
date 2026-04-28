import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BigQueryDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Mock @google-cloud/bigquery — all tests run without a real GCP project
// ---------------------------------------------------------------------------

const mockGetMetadata = vi.fn();
const mockGetQueryResults = vi.fn();
const mockCreateQueryJob = vi.fn();
const mockCreateQueryStream = vi.fn();
const mockGetDatasets = vi.fn();
const mockGetTables = vi.fn();
const mockTableGetMetadata = vi.fn();
const mockQuery = vi.fn();

const mockJob = {
  getMetadata: mockGetMetadata,
  getQueryResults: mockGetQueryResults,
};

const mockDataset = {
  getTables: mockGetTables,
  table: vi.fn(() => ({ getMetadata: mockTableGetMetadata })),
};

const mockBQInstance = {
  createQueryJob: mockCreateQueryJob.mockResolvedValue([mockJob]),
  createQueryStream: mockCreateQueryStream,
  getDatasets: mockGetDatasets,
  dataset: vi.fn(() => mockDataset),
  query: mockQuery,
};

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn(() => mockBQInstance),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  name: 'test-bq',
  type: 'bigquery' as const,
  options: { projectId: 'my-project', location: 'US', defaultDataset: 'analytics' },
};

function makeConn(): Connection {
  return {
    id: 'test-id',
    config: BASE_CONFIG,
    dialect: 'bigquery',
    native: { bq: mockBQInstance, opts: BASE_CONFIG.options },
  };
}

function makeDoneJob(rows: Record<string, unknown>[] = []) {
  mockGetMetadata.mockResolvedValue([{ status: { state: 'DONE' } }]);
  mockGetQueryResults.mockResolvedValue([rows]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BigQueryDriver', () => {
  let driver: BigQueryDriver;

  beforeEach(() => {
    driver = new BigQueryDriver();
    vi.clearAllMocks();
    mockCreateQueryJob.mockResolvedValue([mockJob]);
    mockQuery.mockResolvedValue([[{ '1': 1 }]]);
  });

  // --- capabilities ---

  it('capabilities() reports correct flags', () => {
    const caps = driver.capabilities();
    expect(caps.transactions).toBe(false);
    expect(caps.streaming).toBe(true);
    expect(caps.asyncExecution).toBe(true);
    expect(caps.costEstimate).toBe(true);
    expect(caps.arrowNative).toBe(false);
  });

  it('dialect is bigquery', () => {
    expect(driver.dialect).toBe('bigquery');
  });

  // --- connect ---

  it('connect() throws without projectId', async () => {
    await expect(driver.connect({ name: 'x', type: 'bigquery' })).rejects.toThrow('projectId');
  });

  it('connect() creates BigQuery client with projectId', async () => {
    const { BigQuery } = await import('@google-cloud/bigquery');
    await driver.connect(BASE_CONFIG);
    expect(BigQuery).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'my-project' }),
    );
  });

  // --- disconnect ---

  it('disconnect() is a no-op (HTTP-based)', async () => {
    await expect(driver.disconnect(makeConn())).resolves.toBeUndefined();
  });

  // --- validateConnection ---

  it('validateConnection() returns true on successful query', async () => {
    mockQuery.mockResolvedValue([[{ '1': 1 }]]);
    expect(await driver.validateConnection(makeConn())).toBe(true);
  });

  it('validateConnection() returns false on error', async () => {
    mockQuery.mockRejectedValue(new Error('unauthorized'));
    expect(await driver.validateConnection(makeConn())).toBe(false);
  });

  // --- execute ---

  it('execute() SELECT polls job and returns batch', async () => {
    makeDoneJob([{ user_id: 1, name: 'Alice' }]);
    const result = await driver.execute(makeConn(), 'SELECT user_id, name FROM users');
    expect(result.batch).toBeDefined();
    expect(result.rowCount).toBe(1);
    expect(result.rows).toHaveLength(0);
  });

  it('execute() DDL returns rowCount 0', async () => {
    makeDoneJob([]);
    const result = await driver.execute(makeConn(), 'CREATE TABLE t (id INT64)');
    expect(result.rowCount).toBe(0);
  });

  it('execute() throws when job fails', async () => {
    mockGetMetadata.mockResolvedValue([{
      status: { state: 'DONE', errors: [{ message: 'Table not found' }] },
    }]);
    await expect(driver.execute(makeConn(), 'SELECT * FROM missing_table')).rejects.toThrow('Table not found');
  });

  it('execute() uses maximumBytesBilled when configured', async () => {
    makeDoneJob([]);
    await driver.execute(
      { ...makeConn(), config: { ...BASE_CONFIG, options: { projectId: 'p', maximumBytesBilled: '1000000' } } },
      'SELECT 1',
    );
    expect(mockCreateQueryJob).toHaveBeenCalledWith(
      expect.objectContaining({ maximumBytesBilled: '1000000' }),
    );
  });

  // --- stream ---

  it('stream() calls createQueryStream and yields rows', async () => {
    async function* gen() { yield { id: 1 }; yield { id: 2 }; }
    mockCreateQueryStream.mockReturnValue(gen());

    const rows: Record<string, unknown>[] = [];
    for await (const row of driver.stream(makeConn(), 'SELECT id FROM t')) {
      rows.push(row);
    }
    expect(rows).toHaveLength(2);
    expect(mockCreateQueryStream).toHaveBeenCalled();
  });

  // --- transactions ---

  it('beginTransaction() throws (not supported)', async () => {
    await expect(driver.beginTransaction(makeConn())).rejects.toThrow('transactions');
  });

  // --- introspection ---

  it('getSchemas() maps getDatasets()', async () => {
    mockGetDatasets.mockResolvedValue([[{ id: 'analytics' }, { id: 'raw' }]]);
    const schemas = await driver.getSchemas(makeConn());
    expect(schemas).toHaveLength(2);
    expect(schemas[0]!.name).toBe('analytics');
  });

  it('getTables() maps dataset.getTables()', async () => {
    mockGetTables.mockResolvedValue([[
      { id: 'orders', metadata: { type: 'TABLE' } },
      { id: 'orders_view', metadata: { type: 'VIEW' } },
    ]]);
    const tables = await driver.getTables(makeConn(), 'analytics');
    expect(tables).toHaveLength(2);
    expect(tables[0]!.type).toBe('table');
    expect(tables[1]!.type).toBe('view');
  });

  it('getTables() throws without schema when no defaultDataset', async () => {
    const conn = { ...makeConn(), config: { name: 'x', type: 'bigquery' as const } };
    conn.native = { bq: mockBQInstance, opts: {} };
    await expect(driver.getTables(conn)).rejects.toThrow('schema');
  });

  it('getColumns() maps table schema fields', async () => {
    mockTableGetMetadata.mockResolvedValue([{
      schema: {
        fields: [
          { name: 'id', type: 'INT64', mode: 'REQUIRED' },
          { name: 'name', type: 'STRING', mode: 'NULLABLE', description: 'Full name' },
        ],
      },
    }]);
    const cols = await driver.getColumns(makeConn(), 'analytics', 'orders');
    expect(cols).toHaveLength(2);
    expect(cols[0]).toMatchObject({ name: 'id', type: 'integer', nullable: false });
    expect(cols[1]).toMatchObject({ name: 'name', type: 'string', nullable: true, comment: 'Full name' });
  });

  it('getIndexes() returns empty (BigQuery has no indexes)', async () => {
    const indexes = await driver.getIndexes(makeConn(), 'analytics', 'orders');
    expect(indexes).toHaveLength(0);
  });

  // --- explain ---

  it('explain() runs dry-run job and returns statistics', async () => {
    mockGetMetadata.mockResolvedValue([{
      statistics: { totalBytesProcessed: '1024' },
    }]);
    const result = await driver.explain(makeConn(), 'SELECT * FROM orders');
    expect(result.dialect).toBe('bigquery');
    expect(result.rawPlan).toBeDefined();
    expect(mockCreateQueryJob).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });

  it('explain() with analyze=true uses non-dry-run', async () => {
    mockGetMetadata.mockResolvedValue([{
      statistics: { totalBytesProcessed: '2048' },
    }]);
    await driver.explain(makeConn(), 'SELECT * FROM orders', { analyze: true });
    expect(mockCreateQueryJob).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
  });

  // --- mapNativeType ---

  it('mapNativeType() covers all BigQuery types', () => {
    expect(driver.mapNativeType('STRING')).toBe('string');
    expect(driver.mapNativeType('BYTES')).toBe('binary');
    expect(driver.mapNativeType('INT64')).toBe('integer');
    expect(driver.mapNativeType('FLOAT64')).toBe('float');
    expect(driver.mapNativeType('NUMERIC')).toBe('decimal');
    expect(driver.mapNativeType('BOOL')).toBe('boolean');
    expect(driver.mapNativeType('DATE')).toBe('date');
    expect(driver.mapNativeType('TIME')).toBe('time');
    expect(driver.mapNativeType('DATETIME')).toBe('datetime');
    expect(driver.mapNativeType('TIMESTAMP')).toBe('timestamp');
    expect(driver.mapNativeType('INTERVAL')).toBe('interval');
    expect(driver.mapNativeType('JSON')).toBe('json');
    expect(driver.mapNativeType('ARRAY')).toBe('array');
    expect(driver.mapNativeType('STRUCT')).toBe('json');
    expect(driver.mapNativeType('GEOGRAPHY')).toBe('geometry');
    expect(driver.mapNativeType('UNKNOWN_TYPE')).toBe('unknown');
  });
});
