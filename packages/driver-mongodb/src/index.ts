import { randomUUID } from 'node:crypto';
import { tableFromArrays, type RecordBatch } from 'apache-arrow';
import type {
  ColumnInfo,
  Connection,
  ConnectionConfig,
  ConnectionTestResult,
  DriverAdapter,
  DriverCapabilities,
  ExplainOptions,
  ExplainResult,
  FieldInfo,
  FunctionInfo,
  GrantInfo,
  IndexInfo,
  MaitreType,
  ProcedureInfo,
  QueryResult,
  RoleInfo,
  SchemaInfo,
  TableInfo,
  Transaction,
  TransactionOptions,
  TypeInfo,
} from '@maitredb/plugin-api';

// ---------------------------------------------------------------------------
// Lazy native types
// ---------------------------------------------------------------------------
type MongoClient = import('mongodb').MongoClient;
type MongoDb = import('mongodb').Db;
type MongoOptions = import('@maitredb/plugin-api').MongoOptions;

// ---------------------------------------------------------------------------
// Native connection container
// ---------------------------------------------------------------------------
interface MongoNative {
  client: MongoClient;
  db: MongoDb;
}

// ---------------------------------------------------------------------------
// MongoOperation — structured query accepted by execute()
//
// execute() accepts either:
//   1. A JSON string representing a MongoOperation
//   2. A minimal SQL SELECT (parsed and converted to a find() operation)
// ---------------------------------------------------------------------------
export interface MongoOperation {
  /** Target collection */
  collection: string;
  /** Operation type: find | aggregate | insertOne | insertMany | updateOne | updateMany | deleteOne | deleteMany | command */
  op: 'find' | 'aggregate' | 'insertOne' | 'insertMany' | 'updateOne' | 'updateMany' | 'deleteOne' | 'deleteMany' | 'command';
  /** Filter / pipeline / document depending on op */
  args?: unknown;
  /** Projection for find operations */
  projection?: Record<string, 0 | 1>;
  /** Sort for find operations */
  sort?: Record<string, 1 | -1>;
  /** Limit for find operations */
  limit?: number;
}

// ---------------------------------------------------------------------------
// SQL→MQL minimal parser for simple SELECT statements
// ---------------------------------------------------------------------------

const SIMPLE_SELECT_RE =
  /^\s*SELECT\s+(?<cols>.*?)\s+FROM\s+(?<coll>[A-Za-z_][\w.]*)\s*(?:WHERE\s+(?<where>.+?))?\s*(?:ORDER BY\s+(?<order>.+?))?\s*(?:LIMIT\s+(?<limit>\d+))?\s*$/is;

function parseSqlToMongoOp(sql: string): MongoOperation | null {
  const m = SIMPLE_SELECT_RE.exec(sql);
  if (!m?.groups) return null;
  const { cols, coll, limit } = m.groups as { cols: string; coll: string; where?: string; order?: string; limit?: string };
  const projection: Record<string, 0 | 1> | undefined =
    cols.trim() === '*' ? undefined : Object.fromEntries(cols.split(',').map(c => [c.trim(), 1 as const]));

  return {
    collection: coll,
    op: 'find',
    projection,
    limit: limit ? parseInt(limit, 10) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowsToArrowBatch(rows: Record<string, unknown>[]): RecordBatch {
  if (rows.length === 0) return tableFromArrays({}).batches[0]!;
  // Strip BSON ObjectId and other non-plain types by serializing via JSON
  const plain = rows.map(r => JSON.parse(JSON.stringify(r)) as Record<string, unknown>);
  const colNames = Object.keys(plain[0]!);
  const arrays: Record<string, unknown[]> = {};
  for (const col of colNames) arrays[col] = plain.map(r => r[col] ?? null);
  return tableFromArrays(arrays).batches[0]!;
}

function fieldsFromRows(rows: Record<string, unknown>[]): FieldInfo[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]!).map(name => ({
    name,
    nativeType: 'mixed',
    type: 'unknown' as MaitreType,
    nullable: true,
  }));
}

function nativeFromConn(conn: Connection): MongoNative {
  return conn.native as MongoNative;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class MongoDbDriver implements DriverAdapter {
  readonly dialect = 'mongodb' as const;

  async connect(config: ConnectionConfig): Promise<Connection> {
    const { MongoClient } = await import('mongodb');
    const mongoOpts = config.options as MongoOptions | undefined;

    let url: string;
    if (config.host) {
      const scheme = mongoOpts?.srv ? 'mongodb+srv' : 'mongodb';
      const auth = config.user
        ? `${encodeURIComponent(config.user)}:${encodeURIComponent(config.password ?? '')}@`
        : '';
      const portPart = !mongoOpts?.srv && config.port ? `:${config.port}` : '';
      url = `${scheme}://${auth}${config.host}${portPart}`;
    } else {
      throw new Error('MongoDB connection requires a host');
    }

    const client = new MongoClient(url, {
      authSource: mongoOpts?.authSource,
      replicaSet: mongoOpts?.replicaSet,
      readPreference: (mongoOpts?.readPreference as import('mongodb').ReadPreferenceLike | undefined),
      directConnection: mongoOpts?.directConnection,
      writeConcern: mongoOpts?.writeConcern as import('mongodb').WriteConcern | undefined,
      appName: mongoOpts?.appName ?? 'maitredb',
    });

    await client.connect();
    const db = client.db(config.database);

    return { id: randomUUID(), config, dialect: 'mongodb', native: { client, db } satisfies MongoNative };
  }

  async disconnect(conn: Connection): Promise<void> {
    await nativeFromConn(conn).client.close();
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = performance.now();
    try {
      const conn = await this.connect(config);
      await this.validateConnection(conn);
      await this.disconnect(conn);
      return { success: true, latencyMs: performance.now() - start };
    } catch (err) {
      return {
        success: false,
        latencyMs: performance.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async validateConnection(conn: Connection): Promise<boolean> {
    try {
      await nativeFromConn(conn).db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // execute() — accepts MongoOperation (JSON string) or minimal SQL SELECT
  // ---------------------------------------------------------------------------

  async execute(conn: Connection, query: string, _params?: unknown[]): Promise<QueryResult> {
    const start = performance.now();
    const { db } = nativeFromConn(conn);

    let op: MongoOperation | null = null;

    // Try JSON parse first (structured MongoOperation)
    try {
      op = JSON.parse(query) as MongoOperation;
    } catch {
      // Fall back to SQL→MQL parser
      op = parseSqlToMongoOp(query);
    }

    if (!op) {
      throw new Error(
        'MongoDB execute() requires a JSON-encoded MongoOperation or a simple SQL SELECT. ' +
        'Example: \'{"collection":"users","op":"find","limit":10}\'',
      );
    }

    const rows = await this.runOp(db, op);
    const fields = fieldsFromRows(rows);

    if (op.op === 'insertOne' || op.op === 'insertMany' || op.op === 'updateOne' ||
        op.op === 'updateMany' || op.op === 'deleteOne' || op.op === 'deleteMany') {
      return { rows: [], fields: [], rowCount: rows.length, durationMs: performance.now() - start };
    }

    const batch = rowsToArrowBatch(rows);
    return { rows: [], fields, rowCount: rows.length, durationMs: performance.now() - start, batch };
  }

  private async runOp(db: MongoDb, op: MongoOperation): Promise<Record<string, unknown>[]> {
    const col = db.collection(op.collection);

    switch (op.op) {
      case 'find': {
        const filter = (op.args ?? {}) as import('mongodb').Filter<import('mongodb').Document>;
        let cursor = col.find(filter, { projection: op.projection });
        if (op.sort) cursor = cursor.sort(op.sort);
        if (op.limit) cursor = cursor.limit(op.limit);
        return (await cursor.toArray()) as Record<string, unknown>[];
      }
      case 'aggregate': {
        const pipeline = Array.isArray(op.args) ? (op.args as import('mongodb').Document[]) : [];
        return (await col.aggregate(pipeline).toArray()) as Record<string, unknown>[];
      }
      case 'insertOne': {
        const result = await col.insertOne(op.args as import('mongodb').OptionalId<import('mongodb').Document>);
        return [{ insertedId: result.insertedId?.toString(), acknowledged: result.acknowledged }];
      }
      case 'insertMany': {
        const docs = Array.isArray(op.args) ? (op.args as import('mongodb').OptionalId<import('mongodb').Document>[]) : [];
        const result = await col.insertMany(docs);
        return [{ insertedCount: result.insertedCount, acknowledged: result.acknowledged }];
      }
      case 'updateOne': {
        const { filter, update } = op.args as { filter: import('mongodb').Filter<import('mongodb').Document>; update: import('mongodb').UpdateFilter<import('mongodb').Document> };
        const result = await col.updateOne(filter, update);
        return [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
      }
      case 'updateMany': {
        const { filter, update } = op.args as { filter: import('mongodb').Filter<import('mongodb').Document>; update: import('mongodb').UpdateFilter<import('mongodb').Document> };
        const result = await col.updateMany(filter, update);
        return [{ matchedCount: result.matchedCount, modifiedCount: result.modifiedCount }];
      }
      case 'deleteOne': {
        const result = await col.deleteOne(op.args as import('mongodb').Filter<import('mongodb').Document>);
        return [{ deletedCount: result.deletedCount }];
      }
      case 'deleteMany': {
        const result = await col.deleteMany(op.args as import('mongodb').Filter<import('mongodb').Document>);
        return [{ deletedCount: result.deletedCount }];
      }
      case 'command': {
        const result = await db.command(op.args as import('mongodb').Document);
        return [result];
      }
    }
  }

  async *stream(conn: Connection, query: string, _params?: unknown[]): AsyncIterable<Record<string, unknown>> {
    const { db } = nativeFromConn(conn);

    let op: MongoOperation | null = null;
    try { op = JSON.parse(query) as MongoOperation; } catch { op = parseSqlToMongoOp(query); }

    if (!op) throw new Error('MongoDB stream() requires a JSON-encoded MongoOperation or simple SQL SELECT.');

    const col = db.collection(op.collection);
    if (op.op === 'find') {
      const filter = (op.args ?? {}) as import('mongodb').Filter<import('mongodb').Document>;
      let cursor = col.find(filter, { projection: op.projection });
      if (op.sort) cursor = cursor.sort(op.sort);
      if (op.limit) cursor = cursor.limit(op.limit);
      for await (const doc of cursor) {
        yield JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
      }
    } else if (op.op === 'aggregate') {
      const pipeline = Array.isArray(op.args) ? (op.args as import('mongodb').Document[]) : [];
      for await (const doc of col.aggregate(pipeline)) {
        yield JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
      }
    } else {
      const rows = await this.runOp(db, op);
      yield* rows;
    }
  }

  async cancelQuery(_conn: Connection, _queryId: string): Promise<void> {
    // MongoDB does not support server-side query cancellation via a query ID in the Node.js driver.
    throw new Error('MongoDB does not support query cancellation via cancelQuery().');
  }

  async beginTransaction(conn: Connection, _options?: TransactionOptions): Promise<Transaction> {
    const { client } = nativeFromConn(conn);
    const session = client.startSession();
    session.startTransaction();
    const id = randomUUID();
    return {
      id,
      query: (sql, p?) => this.execute(conn, sql, p),
      commit: async () => {
        await session.commitTransaction();
        await session.endSession();
      },
      rollback: async () => {
        await session.abortTransaction();
        await session.endSession();
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Introspection — schema introspection via collection sampling
  // ---------------------------------------------------------------------------

  /** In MongoDB, "schemas" map to databases. */
  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    const { client } = nativeFromConn(conn);
    const adminDb = client.db('admin');
    const result = await adminDb.command({ listDatabases: 1, nameOnly: true });
    const databases = result['databases'] as Array<{ name: string }>;
    return databases.map((d: { name: string }) => ({ name: d.name }));
  }

  /** In MongoDB, "tables" map to collections. */
  async getTables(conn: Connection, schema?: string): Promise<TableInfo[]> {
    const { client, db } = nativeFromConn(conn);
    const targetDb = schema ? client.db(schema) : db;
    const collections = await targetDb.listCollections().toArray();
    return collections.map(c => ({
      schema: schema ?? conn.config.database ?? '',
      name: c.name,
      type: c.type === 'view' ? 'view' : 'table',
    }));
  }

  /** Infer columns by sampling documents from the collection. */
  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    const { client } = nativeFromConn(conn);
    const db = client.db(schema);
    const samples = await db.collection(table).find({}).limit(100).toArray();

    const fieldMap = new Map<string, Set<string>>();
    for (const doc of samples) {
      for (const [k, v] of Object.entries(doc)) {
        if (!fieldMap.has(k)) fieldMap.set(k, new Set());
        fieldMap.get(k)!.add(typeof v);
      }
    }

    return Array.from(fieldMap.entries()).map(([name, types]) => {
      const nativeType = Array.from(types).join('|');
      return {
        schema,
        table,
        name,
        nativeType,
        type: this.mapNativeType(nativeType),
        nullable: true,
        isPrimaryKey: name === '_id',
      };
    });
  }

  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    const { client } = nativeFromConn(conn);
    const db = client.db(schema);
    const indexes = await db.collection(table).indexes();
    return indexes.map(idx => ({
      schema,
      table,
      name: idx.name ?? '',
      columns: Object.keys(idx.key as Record<string, unknown>),
      unique: idx.unique === true,
      primary: idx.name === '_id_',
    }));
  }

  async getFunctions(_conn: Connection, _schema?: string): Promise<FunctionInfo[]> {
    return [];
  }

  async getProcedures(_conn: Connection, _schema?: string): Promise<ProcedureInfo[]> {
    return [];
  }

  async getTypes(_conn: Connection, _schema?: string): Promise<TypeInfo[]> {
    return [];
  }

  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    try {
      const { client } = nativeFromConn(conn);
      const adminDb = client.db('admin');
      const result = await adminDb.command({ rolesInfo: 1, showBuiltinRoles: false });
      const roles = result['roles'] as Array<{ role: string }>;
      return roles.map((r: { role: string }) => ({ name: r.role, superuser: false, login: true }));
    } catch {
      return [];
    }
  }

  async getGrants(_conn: Connection, _role?: string): Promise<GrantInfo[]> {
    return [];
  }

  async explain(conn: Connection, query: string, _options?: ExplainOptions): Promise<ExplainResult> {
    const { db } = nativeFromConn(conn);

    let op: MongoOperation | null = null;
    try { op = JSON.parse(query) as MongoOperation; } catch { op = parseSqlToMongoOp(query); }
    if (!op) throw new Error('explain() requires a JSON-encoded MongoOperation or simple SQL SELECT.');

    const col = db.collection(op.collection);
    const filter = (op.args ?? {}) as import('mongodb').Filter<import('mongodb').Document>;
    const rawPlan = await col.find(filter).explain('queryPlanner');

    return {
      dialect: 'mongodb',
      rawPlan,
      plan: {
        operation: String((rawPlan as Record<string, unknown>)['queryPlanner'] ?? 'queryPlanner'),
        properties: rawPlan as Record<string, unknown>,
        children: [],
      },
      warnings: [],
    };
  }

  mapNativeType(nativeType: string): MaitreType {
    const t = nativeType.toLowerCase();
    if (t.includes('objectid')) return 'unknown';
    if (t.includes('string')) return 'string';
    if (t.includes('number') || t.includes('int') || t.includes('double')) return 'number';
    if (t.includes('boolean')) return 'boolean';
    if (t.includes('date')) return 'datetime';
    if (t.includes('object') || t.includes('array')) return 'json';
    if (t.includes('binary')) return 'binary';
    return 'unknown';
  }

  capabilities(): DriverCapabilities {
    return {
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: false,
      procedures: false,
      userDefinedTypes: false,
      roles: true,
      schemas: true,
      cancelQuery: false,
      listenNotify: false,
      asyncExecution: false,
      embedded: false,
      costEstimate: false,
      arrowNative: false,
    };
  }
}
