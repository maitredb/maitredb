import { describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from '@maitredb/plugin-api';
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
import { ConfigManager } from '../config.js';
import { ConnectionManager } from '../connection-manager.js';
import { MaitreErrorCode } from '../errors.js';

function createAdapter(dialect: ConnectionConfig['type'], hooks?: {
  connect?: () => Promise<Connection>;
  validateConnection?: (conn: Connection) => Promise<boolean>;
  disconnect?: (conn: Connection) => Promise<void>;
}) {
  let seq = 0;
  const connect = vi.fn(async () => {
    if (hooks?.connect) {
      return hooks.connect();
    }
    seq += 1;
    return {
      id: `${dialect}-${seq}`,
      dialect,
      config: { name: 'demo', type: dialect },
      native: { seq },
    };
  });
  const validateConnection = vi.fn(async (conn: Connection) => hooks?.validateConnection?.(conn) ?? true);
  const disconnect = vi.fn(async (conn: Connection) => hooks?.disconnect?.(conn) ?? undefined);

  const adapter: DriverAdapter = {
    dialect,
    connect,
    disconnect,
    testConnection: async (): Promise<ConnectionTestResult> => ({ success: true, latencyMs: 1 }),
    validateConnection,
    execute: async (): Promise<QueryResult> => ({ rows: [], fields: [] as FieldInfo[], rowCount: 0, durationMs: 1 }),
    stream: async function* () { yield* []; },
    cancelQuery: async () => {},
    beginTransaction: async (): Promise<Transaction> => ({
      id: 'tx',
      query: async () => ({ rows: [], fields: [], rowCount: 0, durationMs: 1 }),
      commit: async () => {},
      rollback: async () => {},
    }),
    getSchemas: async (): Promise<SchemaInfo[]> => [],
    getTables: async (): Promise<TableInfo[]> => [],
    getColumns: async (): Promise<ColumnInfo[]> => [],
    getIndexes: async (): Promise<IndexInfo[]> => [],
    getFunctions: async (): Promise<FunctionInfo[]> => [],
    getProcedures: async (): Promise<ProcedureInfo[]> => [],
    getTypes: async (): Promise<TypeInfo[]> => [],
    getRoles: async (): Promise<RoleInfo[]> => [],
    getGrants: async (): Promise<GrantInfo[]> => [],
    explain: async (): Promise<ExplainResult> => ({
      dialect,
      rawPlan: null,
      plan: { operation: 'noop', children: [], properties: {} },
      warnings: [],
    }),
    mapNativeType: (): MaitreType => 'unknown',
    capabilities: (): DriverCapabilities => ({
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: true,
      userDefinedTypes: false,
      roles: true,
      schemas: true,
      cancelQuery: true,
      listenNotify: false,
      asyncExecution: false,
      embedded: false,
      costEstimate: false,
    }),
  };

  return { adapter, connect, validateConnection, disconnect };
}

describe('ConnectionManager', () => {
  it('acquires and releases generic-pooled connections', async () => {
    const registry = new PluginRegistry();
    const mock = createAdapter('sqlite');
    registry.register('sqlite', mock.adapter);

    const manager = new ConnectionManager(registry, new ConfigManager(), {
      resolveConnection: async () => ({
        name: 'dev',
        type: 'sqlite',
        pool: { max: 1, acquireTimeoutMs: 20, maxWaitingClients: 1 },
      }),
    });

    const first = await manager.getConnection('dev');
    await expect(manager.getConnection('dev')).rejects.toMatchObject({ code: MaitreErrorCode.POOL_EXHAUSTED });

    await manager.releaseConnection(first);
    const second = await manager.getConnection('dev');
    await manager.releaseConnection(second);
    await manager.closeAll();

    expect(mock.connect).toHaveBeenCalledTimes(1);
    expect(mock.disconnect).toHaveBeenCalledTimes(1);
  });

  it('reconnects unhealthy native pooled connections', async () => {
    const registry = new PluginRegistry();
    let validateCalls = 0;
    const mock = createAdapter('postgresql', {
      validateConnection: async () => {
        validateCalls += 1;
        return validateCalls > 1;
      },
    });
    registry.register('postgresql', mock.adapter);

    const manager = new ConnectionManager(registry, new ConfigManager(), {
      resolveConnection: async () => ({
        name: 'pg',
        type: 'postgresql',
      }),
    });

    const conn = await manager.getConnection('pg');
    await manager.releaseConnection(conn);
    await manager.closeAll();

    expect(mock.connect).toHaveBeenCalledTimes(2);
    expect(mock.disconnect).toHaveBeenCalledTimes(2);
  });
});
