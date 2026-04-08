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
import { QueryExecutor } from '../executor.js';
import { MaitreErrorCode } from '../errors.js';

function makeAdapter(executeImpl: (sql: string, params?: unknown[]) => Promise<QueryResult>): DriverAdapter {
  return {
    dialect: 'sqlite',
    connect: async () => ({ id: 'c', dialect: 'sqlite', config: { name: 'c', type: 'sqlite' }, native: {} }),
    disconnect: async () => {},
    testConnection: async (): Promise<ConnectionTestResult> => ({ success: true, latencyMs: 1 }),
    validateConnection: async () => true,
    execute: async (_conn, sql, params) => executeImpl(sql, params),
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

describe('QueryExecutor', () => {
  const conn: Connection = {
    id: 'conn-1',
    dialect: 'sqlite',
    config: { name: 'prod', type: 'sqlite', tags: ['production'] },
    native: {},
  };

  it('invalidates schema and permission cache scopes for DDL statements', async () => {
    const invalidateForConnection = vi.fn(async () => {});
    const record = vi.fn(async () => {});
    const history = { record };
    const adapter = makeAdapter(async () => ({ rows: [], fields: [] as FieldInfo[], rowCount: 1, durationMs: 0 }));
    const executor = new QueryExecutor(adapter, {
      cache: { invalidateForConnection },
      history,
      connectionId: 'prod',
      connectionName: 'prod',
      caller: 'human',
      logParamsForProduction: false,
    });

    await executor.execute(conn, 'CREATE TABLE x(id INTEGER)', [1]);
    await executor.execute(conn, 'GRANT SELECT ON x TO reader', [2]);

    expect(invalidateForConnection).toHaveBeenNthCalledWith(1, 'prod', 'sqlite', 'schema');
    expect(invalidateForConnection).toHaveBeenNthCalledWith(2, 'prod', 'sqlite', 'permissions');
    expect(record).toHaveBeenCalledTimes(2);
    const first = (record.mock.calls as unknown[][])[0]?.[0] as { params?: unknown[] } | undefined;
    expect(first?.params).toBeUndefined();
  });

  it('records params for non-production connections', async () => {
    const record = vi.fn(async () => {});
    const history = { record };
    const adapter = makeAdapter(async () => ({ rows: [], fields: [], rowCount: 0, durationMs: 0 }));
    const executor = new QueryExecutor(adapter, {
      history,
      connectionName: 'dev',
      caller: 'human',
    });

    await executor.execute(
      {
        ...conn,
        config: { name: 'dev', type: 'sqlite' },
      },
      'SELECT ?',
      [123],
    );

    const first = (record.mock.calls as unknown[][])[0]?.[0] as { params?: unknown[] } | undefined;
    expect(first?.params).toEqual([123]);
  });

  it('records wrapped errors in history entries', async () => {
    const record = vi.fn(async () => {});
    const history = { record };
    const adapter = makeAdapter(async () => {
      throw new Error('SQLITE_ERROR near "FROMM"');
    });
    const executor = new QueryExecutor(adapter, {
      history,
      connectionName: 'dev',
    });

    await expect(executor.execute(conn, 'SELECT * FROMM t')).rejects.toMatchObject({
      code: MaitreErrorCode.SYNTAX_ERROR,
    });
    expect(record).toHaveBeenCalledTimes(1);
    const first = (record.mock.calls as unknown[][])[0]?.[0] as { error?: { code: number } } | undefined;
    expect(first?.error?.code).toBe(MaitreErrorCode.SYNTAX_ERROR);
  });
});
