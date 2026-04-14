import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClickHouseDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Mock @clickhouse/client — all tests run without a real ClickHouse server
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockCommand = vi.fn();
const mockPing = vi.fn();
const mockClose = vi.fn();

const mockClient = {
  query: mockQuery,
  command: mockCommand,
  ping: mockPing,
  close: mockClose,
};

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => mockClient),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock ClickHouse Arrow response for a single SELECT. */
function makeArrowResponse(rows: Record<string, unknown>[]) {
  // Return a JSONEachRow fallback since we can't easily create Arrow IPC in tests
  return {
    buffer: vi.fn().mockRejectedValue(new Error('Arrow not mocked')),  // force fallback
    json: vi.fn().mockResolvedValue(rows),
    stream: vi.fn().mockReturnValue((async function* () {})()),
  };
}

function makeJsonResponse(rows: Record<string, unknown>[]) {
  return {
    json: vi.fn().mockResolvedValue(rows),
    buffer: vi.fn().mockRejectedValue(new Error('use json')),
    stream: vi.fn(),
  };
}

const BASE_CONFIG = {
  name: 'test',
  type: 'clickhouse' as const,
  host: 'localhost',
  port: 8123,
  user: 'default',
  database: 'default',
};

function makeConn(): Connection {
  return { id: 'test-id', config: BASE_CONFIG, dialect: 'clickhouse', native: mockClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClickHouseDriver', () => {
  let driver: ClickHouseDriver;

  beforeEach(() => {
    driver = new ClickHouseDriver();
    vi.clearAllMocks();
    mockPing.mockResolvedValue({ success: true });
    mockClose.mockResolvedValue(undefined);
    mockCommand.mockResolvedValue(undefined);
  });

  // --- Lifecycle ---

  it('connect() creates client with correct URL and credentials', async () => {
    const { createClient } = await import('@clickhouse/client');
    const conn = await driver.connect(BASE_CONFIG);
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'http://localhost:8123', username: 'default' }),
    );
    expect(conn.dialect).toBe('clickhouse');
    expect(mockPing).toHaveBeenCalled();
  });

  it('connect() throws when ping fails', async () => {
    mockPing.mockResolvedValue({ success: false, error: new Error('refused') });
    await expect(driver.connect(BASE_CONFIG)).rejects.toThrow(/ping failed/);
  });

  it('disconnect() calls client.close()', async () => {
    const conn = makeConn();
    await driver.disconnect(conn);
    expect(mockClose).toHaveBeenCalled();
  });

  it('validateConnection() returns true on successful ping', async () => {
    const conn = makeConn();
    mockPing.mockResolvedValue({ success: true });
    expect(await driver.validateConnection(conn)).toBe(true);
  });

  it('validateConnection() returns false on failed ping', async () => {
    const conn = makeConn();
    mockPing.mockRejectedValue(new Error('network error'));
    expect(await driver.validateConnection(conn)).toBe(false);
  });

  // --- Execution ---

  it('execute() DDL calls command(), not query()', async () => {
    const conn = makeConn();
    const result = await driver.execute(conn, 'CREATE TABLE t (id UInt32) ENGINE = MergeTree() ORDER BY id');
    expect(mockCommand).toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(result.rowCount).toBe(0);
  });

  it('execute() SELECT falls back to JSONEachRow when Arrow unavailable', async () => {
    const conn = makeConn();
    mockQuery
      .mockRejectedValueOnce(new Error('Arrow format not supported'))  // Arrow attempt fails
      .mockResolvedValueOnce(makeJsonResponse([{ id: 1, name: 'a' }]));  // JSONEachRow succeeds

    const result = await driver.execute(conn, 'SELECT id, name FROM t');
    expect(result.rowCount).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ id: 1, name: 'a' });
  });

  it('execute() INSERT calls command()', async () => {
    const conn = makeConn();
    await driver.execute(conn, 'INSERT INTO t VALUES (1)');
    expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({ query: 'INSERT INTO t VALUES (1)' }));
  });

  // --- Streaming ---

  it('streamBatches() falls back to execute() when ArrowStream fails', async () => {
    const conn = makeConn();
    mockQuery
      .mockRejectedValueOnce(new Error('ArrowStream not available'))  // streamBatches attempt
      .mockRejectedValueOnce(new Error('Arrow not available'))        // execute() Arrow attempt
      .mockResolvedValueOnce(makeJsonResponse([{ x: 1 }, { x: 2 }])); // JSONEachRow fallback

    const batches: import('apache-arrow').RecordBatch[] = [];
    for await (const b of driver.streamBatches!(conn, 'SELECT x FROM t')) {
      batches.push(b);
    }
    const totalRows = batches.reduce((s, b) => s + b.numRows, 0);
    expect(totalRows).toBe(2);
  });

  // --- cancelQuery ---

  it('cancelQuery() sends KILL QUERY command', async () => {
    const conn = makeConn();
    await driver.cancelQuery(conn, 'abc-123');
    expect(mockCommand).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.stringContaining('KILL QUERY') }),
    );
  });

  // --- Transactions ---

  it('beginTransaction() throws TRANSACTION_NOT_SUPPORTED', async () => {
    const conn = makeConn();
    await expect(driver.beginTransaction(conn)).rejects.toThrow(/transaction/i);
  });

  // --- Introspection ---

  it('getSchemas() maps system.databases rows to SchemaInfo[]', async () => {
    const conn = makeConn();
    mockQuery
      .mockRejectedValueOnce(new Error('no arrow'))
      .mockResolvedValueOnce(makeJsonResponse([{ name: 'default' }, { name: 'system' }]));
    const schemas = await driver.getSchemas(conn);
    expect(schemas.map(s => s.name)).toContain('default');
    expect(schemas.map(s => s.name)).toContain('system');
  });

  it('getTables() detects VIEW table type', async () => {
    const conn = makeConn();
    mockQuery
      .mockRejectedValueOnce(new Error('no arrow'))
      .mockResolvedValueOnce(makeJsonResponse([
        { table_schema: 'default', table_name: 'orders', table_type: 'TABLE' },
        { table_schema: 'default', table_name: 'order_view', table_type: 'VIEW' },
      ]));
    const tables = await driver.getTables(conn, 'default');
    const view = tables.find(t => t.name === 'order_view');
    expect(view?.type).toBe('view');
  });

  it('getColumns() maps is_in_primary_key to isPrimaryKey', async () => {
    const conn = makeConn();
    mockQuery
      .mockRejectedValueOnce(new Error('no arrow'))
      .mockResolvedValueOnce(makeJsonResponse([
        { name: 'id', type: 'UInt32', is_in_primary_key: 1, default_expression: null },
        { name: 'val', type: 'String', is_in_primary_key: 0, default_expression: null },
      ]));
    const cols = await driver.getColumns(conn, 'default', 'orders');
    expect(cols[0]?.isPrimaryKey).toBe(true);
    expect(cols[1]?.isPrimaryKey).toBe(false);
  });

  it('getRoles() returns RoleInfo[] from system.roles', async () => {
    const conn = makeConn();
    mockQuery
      .mockRejectedValueOnce(new Error('no arrow'))
      .mockResolvedValueOnce(makeJsonResponse([{ name: 'analyst' }, { name: 'readonly' }]));
    const roles = await driver.getRoles(conn);
    expect(roles.map(r => r.name)).toEqual(['analyst', 'readonly']);
    expect(roles[0]?.login).toBe(true);
  });

  it('getIndexes() returns empty array (ClickHouse uses sort keys)', async () => {
    const conn = makeConn();
    expect(await driver.getIndexes(conn, 'default', 'orders')).toEqual([]);
  });

  // --- Type mapping ---

  it('mapNativeType() strips Nullable() wrapper', () => {
    expect(driver.mapNativeType('Nullable(String)')).toBe('string');
    expect(driver.mapNativeType('Nullable(UInt32)')).toBe('integer');
    expect(driver.mapNativeType('Nullable(Float64)')).toBe('float');
  });

  it('mapNativeType() strips LowCardinality() wrapper', () => {
    expect(driver.mapNativeType('LowCardinality(String)')).toBe('string');
  });

  it('mapNativeType() covers core ClickHouse types', () => {
    expect(driver.mapNativeType('UInt32')).toBe('integer');
    expect(driver.mapNativeType('Int64')).toBe('integer');
    expect(driver.mapNativeType('Float32')).toBe('float');
    expect(driver.mapNativeType('Float64')).toBe('float');
    expect(driver.mapNativeType('Decimal(18,4)')).toBe('decimal');
    expect(driver.mapNativeType('String')).toBe('string');
    expect(driver.mapNativeType('Bool')).toBe('boolean');
    expect(driver.mapNativeType('Date')).toBe('date');
    expect(driver.mapNativeType('DateTime64(3)')).toBe('timestamp');
    expect(driver.mapNativeType('UUID')).toBe('uuid');
    expect(driver.mapNativeType('Array(String)')).toBe('array');
    expect(driver.mapNativeType('Enum8(\'a\'=1)')).toBe('string');
  });

  // --- Capabilities ---

  it('capabilities() has arrowNative: true and transactions: false', () => {
    const caps = driver.capabilities();
    expect(caps.arrowNative).toBe(true);
    expect(caps.transactions).toBe(false);
    expect(caps.roles).toBe(true);
    expect(caps.cancelQuery).toBe(true);
    expect(caps.embedded).toBe(false);
  });
});
