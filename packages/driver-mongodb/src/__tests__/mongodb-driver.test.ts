import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MongoDbDriver } from '../index.js';
import type { Connection } from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Mock mongodb — all tests run without a real MongoDB server
// ---------------------------------------------------------------------------

const mockToArray = vi.fn();
const mockFind = vi.fn();
const mockAggregate = vi.fn();
const mockInsertOne = vi.fn();
const mockInsertMany = vi.fn();
const mockUpdateOne = vi.fn();
const mockDeleteOne = vi.fn();
const mockDeleteMany = vi.fn();
const mockIndexes = vi.fn();
const mockExplain = vi.fn();
const mockDbCommand = vi.fn();
const mockListCollections = vi.fn();
const mockClose = vi.fn();
const mockConnect = vi.fn();
const mockStartSession = vi.fn();
const mockCommitTransaction = vi.fn();
const mockAbortTransaction = vi.fn();
const mockEndSession = vi.fn();

const mockCursor = {
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: mockToArray,
  explain: mockExplain,
  [Symbol.asyncIterator]: vi.fn().mockReturnValue((async function* () {})()),
};

const mockCollection = {
  find: mockFind.mockReturnValue(mockCursor),
  aggregate: mockAggregate.mockReturnValue({ toArray: mockToArray, [Symbol.asyncIterator]: vi.fn().mockReturnValue((async function* () {})()) }),
  insertOne: mockInsertOne,
  insertMany: mockInsertMany,
  updateOne: mockUpdateOne,
  deleteOne: mockDeleteOne,
  deleteMany: mockDeleteMany,
  indexes: mockIndexes,
};

const mockDb = {
  collection: vi.fn(() => mockCollection),
  command: mockDbCommand,
  listCollections: mockListCollections.mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
};

const mockMongoClient = {
  connect: mockConnect,
  close: mockClose,
  db: vi.fn(() => mockDb),
  startSession: mockStartSession.mockReturnValue({
    startTransaction: vi.fn(),
    commitTransaction: mockCommitTransaction.mockResolvedValue(undefined),
    abortTransaction: mockAbortTransaction.mockResolvedValue(undefined),
    endSession: mockEndSession.mockResolvedValue(undefined),
  }),
};

vi.mock('mongodb', () => ({
  MongoClient: vi.fn(() => mockMongoClient),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  name: 'test-mongo',
  type: 'mongodb' as const,
  host: 'localhost',
  port: 27017,
  user: 'admin',
  password: 'secret',
  database: 'testdb',
};

function makeConn(): Connection {
  return { id: 'test-id', config: BASE_CONFIG, dialect: 'mongodb', native: { client: mockMongoClient, db: mockDb } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MongoDbDriver', () => {
  let driver: MongoDbDriver;

  beforeEach(() => {
    driver = new MongoDbDriver();
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockDbCommand.mockResolvedValue({ ok: 1 });
    mockFind.mockReturnValue(mockCursor);
    mockToArray.mockResolvedValue([]);
    mockIndexes.mockResolvedValue([]);
    mockExplain.mockResolvedValue({ queryPlanner: 'COLLSCAN' });
    mockInsertOne.mockResolvedValue({ insertedId: 'abc', acknowledged: true });
    mockInsertMany.mockResolvedValue({ insertedCount: 2, acknowledged: true });
    mockUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockDeleteMany.mockResolvedValue({ deletedCount: 3 });
  });

  // --- capabilities ---

  it('capabilities() reports correct flags', () => {
    const caps = driver.capabilities();
    expect(caps.transactions).toBe(true);
    expect(caps.streaming).toBe(true);
    expect(caps.roles).toBe(true);
    expect(caps.schemas).toBe(true);
    expect(caps.arrowNative).toBe(false);
    expect(caps.procedures).toBe(false);
  });

  it('dialect is mongodb', () => {
    expect(driver.dialect).toBe('mongodb');
  });

  // --- connect ---

  it('connect() throws when host is missing', async () => {
    await expect(driver.connect({ name: 'x', type: 'mongodb' })).rejects.toThrow('host');
  });

  it('connect() calls MongoClient.connect()', async () => {
    await driver.connect(BASE_CONFIG);
    expect(mockConnect).toHaveBeenCalled();
  });

  it('connect() uses SRV scheme when srv option is set', async () => {
    const { MongoClient } = await import('mongodb');
    await driver.connect({ ...BASE_CONFIG, options: { srv: true } });
    expect(MongoClient).toHaveBeenCalledWith(
      expect.stringContaining('mongodb+srv://'),
      expect.any(Object),
    );
  });

  // --- disconnect ---

  it('disconnect() calls client.close()', async () => {
    await driver.disconnect(makeConn());
    expect(mockClose).toHaveBeenCalled();
  });

  // --- validateConnection ---

  it('validateConnection() returns true on db.command ping', async () => {
    mockDbCommand.mockResolvedValue({ ok: 1 });
    expect(await driver.validateConnection(makeConn())).toBe(true);
  });

  it('validateConnection() returns false on error', async () => {
    mockDbCommand.mockRejectedValue(new Error('network error'));
    expect(await driver.validateConnection(makeConn())).toBe(false);
  });

  // --- execute with MongoOperation JSON ---

  it('execute() find returns batch and empty rows', async () => {
    mockToArray.mockResolvedValue([{ _id: 'x', name: 'Alice' }]);
    const result = await driver.execute(makeConn(), JSON.stringify({ collection: 'users', op: 'find' }));
    expect(result.rows).toHaveLength(0);
    expect(result.batch).toBeDefined();
    expect(result.rowCount).toBe(1);
  });

  it('execute() aggregate returns batch', async () => {
    const fakeCursor = { toArray: vi.fn().mockResolvedValue([{ count: 5 }]) };
    mockAggregate.mockReturnValue(fakeCursor);
    const result = await driver.execute(
      makeConn(),
      JSON.stringify({ collection: 'orders', op: 'aggregate', args: [{ $group: { _id: null, count: { $sum: 1 } } }] }),
    );
    expect(result.batch).toBeDefined();
    expect(result.rowCount).toBe(1);
  });

  it('execute() insertOne returns rowCount', async () => {
    const result = await driver.execute(
      makeConn(),
      JSON.stringify({ collection: 'users', op: 'insertOne', args: { name: 'Bob' } }),
    );
    expect(result.rowCount).toBe(1);
    expect(result.rows).toHaveLength(0);
  });

  it('execute() deleteMany returns rowCount', async () => {
    const result = await driver.execute(
      makeConn(),
      JSON.stringify({ collection: 'users', op: 'deleteMany', args: {} }),
    );
    expect(result.rowCount).toBe(1);
  });

  // --- execute with SQL SELECT ---

  it('execute() parses simple SQL SELECT', async () => {
    mockToArray.mockResolvedValue([{ id: 1 }]);
    const result = await driver.execute(makeConn(), 'SELECT * FROM orders LIMIT 10');
    expect(result.batch).toBeDefined();
    expect(mockFind).toHaveBeenCalled();
  });

  it('execute() throws for unsupported SQL', async () => {
    await expect(driver.execute(makeConn(), 'UPDATE foo SET x=1')).rejects.toThrow('MongoOperation');
  });

  // --- stream ---

  it('stream() yields rows for find operation', async () => {
    async function* gen() { yield { id: 1 }; yield { id: 2 }; }
    mockFind.mockReturnValue({ ...mockCursor, [Symbol.asyncIterator]: vi.fn().mockReturnValue(gen()) });
    const rows: Record<string, unknown>[] = [];
    for await (const row of driver.stream(makeConn(), JSON.stringify({ collection: 'users', op: 'find' }))) {
      rows.push(row);
    }
    expect(rows).toHaveLength(2);
  });

  // --- transactions ---

  it('beginTransaction() starts session and returns commit/rollback', async () => {
    const txn = await driver.beginTransaction(makeConn());
    expect(txn.id).toBeDefined();
    await txn.commit();
    expect(mockCommitTransaction).toHaveBeenCalled();
    await txn.rollback();
    expect(mockAbortTransaction).toHaveBeenCalled();
  });

  // --- introspection ---

  it('getSchemas() maps listDatabases result', async () => {
    mockDbCommand.mockResolvedValue({ databases: [{ name: 'testdb' }, { name: 'admin' }] });
    const schemas = await driver.getSchemas(makeConn());
    expect(schemas).toHaveLength(2);
    expect(schemas[0]!.name).toBe('testdb');
  });

  it('getTables() maps listCollections result', async () => {
    mockListCollections.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{ name: 'users', type: 'collection' }, { name: 'orders', type: 'collection' }]),
    });
    const tables = await driver.getTables(makeConn());
    expect(tables).toHaveLength(2);
    expect(tables[0]!.name).toBe('users');
    expect(tables[0]!.type).toBe('table');
  });

  it('getColumns() samples documents for field inference', async () => {
    mockToArray.mockResolvedValue([{ _id: 'abc', name: 'Alice', age: 30 }]);
    const cols = await driver.getColumns(makeConn(), 'testdb', 'users');
    expect(cols.length).toBeGreaterThan(0);
    const idCol = cols.find(c => c.name === '_id');
    expect(idCol?.isPrimaryKey).toBe(true);
  });

  it('getIndexes() maps collection.indexes() result', async () => {
    mockIndexes.mockResolvedValue([
      { name: '_id_', key: { _id: 1 }, unique: true },
      { name: 'email_1', key: { email: 1 }, unique: true },
    ]);
    const indexes = await driver.getIndexes(makeConn(), 'testdb', 'users');
    expect(indexes).toHaveLength(2);
    expect(indexes[0]!.primary).toBe(true);
    expect(indexes[1]!.unique).toBe(true);
  });

  it('getRoles() returns roles from rolesInfo command', async () => {
    mockDbCommand.mockResolvedValue({ roles: [{ role: 'read' }, { role: 'readWrite' }] });
    const roles = await driver.getRoles(makeConn());
    expect(roles).toHaveLength(2);
    expect(roles[0]!.name).toBe('read');
  });

  // --- explain ---

  it('explain() calls find().explain() and returns plan', async () => {
    mockExplain.mockResolvedValue({ queryPlanner: { winningPlan: 'COLLSCAN' } });
    const result = await driver.explain(makeConn(), JSON.stringify({ collection: 'users', op: 'find' }));
    expect(result.dialect).toBe('mongodb');
    expect(result.rawPlan).toBeDefined();
  });

  // --- mapNativeType ---

  it('mapNativeType() covers all categories', () => {
    expect(driver.mapNativeType('string')).toBe('string');
    expect(driver.mapNativeType('number')).toBe('number');
    expect(driver.mapNativeType('boolean')).toBe('boolean');
    expect(driver.mapNativeType('date')).toBe('datetime');
    expect(driver.mapNativeType('object')).toBe('json');
    expect(driver.mapNativeType('binary')).toBe('binary');
    expect(driver.mapNativeType('objectid')).toBe('unknown');
  });
});
