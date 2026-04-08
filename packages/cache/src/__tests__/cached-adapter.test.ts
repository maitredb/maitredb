import { describe, expect, it, vi } from 'vitest';
import type {
  ColumnInfo,
  Connection,
  ConnectionConfig,
  ConnectionTestResult,
  DriverAdapter,
  DriverCapabilities,
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
  TypeInfo,
} from '@maitredb/plugin-api';
import { CacheManager } from '../cache-manager.js';
import { CachedAdapter } from '../cached-adapter.js';

function makeAdapter(calls: { getTables: number; execute: number }): DriverAdapter {
  return {
    dialect: 'sqlite',
    connect: async (config: ConnectionConfig): Promise<Connection> => ({
      id: 'conn',
      dialect: 'sqlite',
      config,
      native: {},
    }),
    disconnect: async () => {},
    testConnection: async (): Promise<ConnectionTestResult> => ({ success: true, latencyMs: 1 }),
    validateConnection: async () => true,
    execute: async (): Promise<QueryResult> => {
      calls.execute += 1;
      return { rows: [{ ok: 1 }], fields: [{ name: 'ok', nativeType: 'INTEGER', type: 'integer' } as FieldInfo], rowCount: 1, durationMs: 1 };
    },
    stream: async function* () { yield* []; },
    cancelQuery: async () => {},
    beginTransaction: async (): Promise<Transaction> => ({
      id: 'tx',
      query: async () => ({ rows: [], fields: [], rowCount: 0, durationMs: 1 }),
      commit: async () => {},
      rollback: async () => {},
    }),
    getSchemas: async (): Promise<SchemaInfo[]> => [{ name: 'main' }],
    getTables: async (): Promise<TableInfo[]> => {
      calls.getTables += 1;
      return [{ schema: 'main', name: 'items', type: 'table' }];
    },
    getColumns: async (): Promise<ColumnInfo[]> => [],
    getIndexes: async (): Promise<IndexInfo[]> => [],
    getFunctions: async (): Promise<FunctionInfo[]> => [],
    getProcedures: async (): Promise<ProcedureInfo[]> => [],
    getTypes: async (): Promise<TypeInfo[]> => [],
    getRoles: async (): Promise<RoleInfo[]> => [],
    getGrants: async (): Promise<GrantInfo[]> => [],
    explain: async (): Promise<ExplainResult> => ({
      dialect: 'sqlite',
      rawPlan: null,
      plan: { operation: 'noop', children: [], properties: {} },
      warnings: [],
    }),
    mapNativeType: (): MaitreType => 'unknown',
    capabilities: (): DriverCapabilities => ({
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: false,
      procedures: false,
      userDefinedTypes: false,
      roles: false,
      schemas: false,
      cancelQuery: false,
      listenNotify: false,
      asyncExecution: false,
      embedded: true,
      costEstimate: false,
    }),
  };
}

describe('CachedAdapter', () => {
  it('caches introspection calls and invalidates by scope', async () => {
    const counts = { getTables: 0, execute: 0 };
    const cache = new CacheManager({ diskEnabled: false });
    const adapter = new CachedAdapter(makeAdapter(counts), cache);
    const conn: Connection = {
      id: 'conn-1',
      dialect: 'sqlite',
      config: { name: 'dev', type: 'sqlite' },
      native: {},
    };

    const first = await adapter.getTables(conn, 'main');
    const second = await adapter.getTables(conn, 'main');
    expect(first).toEqual(second);
    expect(counts.getTables).toBe(1);

    await cache.invalidateForConnection('dev', 'sqlite', 'schema');
    await adapter.getTables(conn, 'main');
    expect(counts.getTables).toBe(2);
  });

  it('passes through non-introspection calls', async () => {
    const counts = { getTables: 0, execute: 0 };
    const cache = new CacheManager({ diskEnabled: false });
    const inner = makeAdapter(counts);
    const spy = vi.spyOn(inner, 'execute');
    const adapter = new CachedAdapter(inner, cache);

    const conn: Connection = {
      id: 'conn-2',
      dialect: 'sqlite',
      config: { name: 'dev', type: 'sqlite' },
      native: {},
    };

    await adapter.execute(conn, 'SELECT 1');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(counts.execute).toBe(1);
  });
});
