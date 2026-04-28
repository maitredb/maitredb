import { CacheManager, CachedAdapter } from '@maitredb/cache';
import {
  ConfigManager,
  ConnectionManager,
  HistoryStore,
  MaitreError,
  QueryExecutor,
  recordBatchToRows,
} from '@maitredb/core';
import { PluginRegistry, type Connection, type ConnectionConfig, type DriverAdapter } from '@maitredb/plugin-api';

import { isPotentiallyMutatingQuery } from './query-guard.js';

type McpQueryResult = {
  rowCount: number;
  durationMs: number;
  fields: Array<{ name: string; nativeType: string; type: string }>;
  rows: Record<string, unknown>[];
  truncated: boolean;
};

export class MaitredbMcpRuntime {
  private readonly configManager: ConfigManager;
  private readonly registry: PluginRegistry;
  private readonly cacheManager: CacheManager;
  private readonly historyStore: HistoryStore;
  private readonly connectionManager: ConnectionManager;

  constructor() {
    this.configManager = new ConfigManager();
    this.registry = new PluginRegistry();
    this.registerBuiltInDrivers(this.registry);

    const cfg = this.configManager.getConfig();
    this.cacheManager = new CacheManager(cfg.cache);
    this.historyStore = new HistoryStore(cfg.history);

    this.connectionManager = new ConnectionManager(this.registry, this.configManager, {
      resolveConnection: (name) => this.resolveConnectionConfig(name),
      wrapAdapter: (adapter) => (this.cacheManager.isEnabled() ? new CachedAdapter(adapter, this.cacheManager) : adapter),
    });
  }

  async close(): Promise<void> {
    await this.connectionManager.closeAll();
    this.cacheManager.close();
    this.historyStore.close();
  }

  async listConnections(): Promise<string[]> {
    const names = new Set<string>(Object.keys(this.configManager.getConnections()));
    const credentialOnly = await this.configManager.credentials.list();
    for (const name of credentialOnly) names.add(name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  async getSchemas(connection: string): Promise<unknown[]> {
    return this.withConnection(connection, (conn) => conn.adapter.getSchemas(conn));
  }

  async getTables(connection: string, schema?: string): Promise<unknown[]> {
    return this.withConnection(connection, (conn) => conn.adapter.getTables(conn, schema));
  }

  async getColumns(connection: string, schema: string, table: string): Promise<unknown[]> {
    return this.withConnection(connection, (conn) => conn.adapter.getColumns(conn, schema, table));
  }

  async getIndexes(connection: string, schema: string, table: string): Promise<unknown[]> {
    return this.withConnection(connection, (conn) => conn.adapter.getIndexes(conn, schema, table));
  }

  async explain(connection: string, sql: string, analyze = false): Promise<unknown> {
    return this.withConnection(connection, (conn) => conn.adapter.explain(conn, sql, { analyze }));
  }

  async query(connection: string, sql: string, maxRows: number): Promise<McpQueryResult> {
    if (isPotentiallyMutatingQuery(sql)) {
      throw new MaitreError(
        3005,
        'MCP query tool is read-only. Mutating or multi-statement SQL is blocked.',
      );
    }

    return this.withConnection(connection, async (conn) => {
      const config = this.configManager.getConfig();
      const executor = new QueryExecutor(conn.adapter, {
        maxBufferedRows: config.maxRows,
        cache: this.cacheManager,
        history: this.historyStore,
        connectionId: connection,
        connectionName: connection,
        caller: 'agent',
        logParamsForProduction: config.history?.logParamsForProduction,
      });

      const result = await executor.execute(conn, sql);
      const rows = result.batch ? recordBatchToRows(result.batch) : result.rows;
      const limitedRows = rows.slice(0, maxRows);

      return {
        rowCount: result.rowCount,
        durationMs: result.durationMs,
        fields: result.fields.map((field) => ({
          name: field.name,
          nativeType: field.nativeType,
          type: field.type,
        })),
        rows: sanitizeRows(limitedRows),
        truncated: rows.length > maxRows,
      };
    });
  }

  private async withConnection<T>(connectionName: string, operation: (conn: Connection & { adapter: DriverAdapter }) => Promise<T>): Promise<T> {
    const conn = await this.connectionManager.getConnection(connectionName);
    try {
      return await operation(conn as Connection & { adapter: DriverAdapter });
    } finally {
      await this.connectionManager.releaseConnection(conn);
    }
  }

  private async resolveConnectionConfig(connectionName: string): Promise<ConnectionConfig> {
    let saved: ConnectionConfig | undefined;
    try {
      saved = this.configManager.getConnection(connectionName);
    } catch {
      saved = undefined;
    }

    const credential = await this.configManager.getCredential(connectionName);

    if (!saved) {
      if (credential?.kind === 'dsn') {
        const config = parseMinimalDsn(connectionName, credential.dsn);
        if (credential.dsn.includes('@') && config.passwordFromDsn) {
          config.config.password = config.passwordFromDsn;
        }
        return config.config;
      }

      throw new MaitreError(1001, `Connection "${connectionName}" not found`);
    }

    const resolved: ConnectionConfig = {
      ...saved,
      options: saved.options ? { ...(saved.options as Record<string, unknown>) } : undefined,
    };

    if (!credential) return resolved;

    switch (credential.kind) {
      case 'password':
        resolved.password = credential.password;
        return resolved;
      case 'token':
        resolved.options = {
          ...((resolved.options ?? {}) as Record<string, unknown>),
          accessToken: credential.accessToken,
          refreshToken: credential.refreshToken,
          expiresAt: credential.expiresAt,
          refreshExpiresAt: credential.refreshExpiresAt,
        };
        return resolved;
      case 'key-pair':
        resolved.options = {
          ...((resolved.options ?? {}) as Record<string, unknown>),
          privateKeyPath: credential.privateKeyPath,
          privateKeyPassphrase: credential.passphrase,
        };
        return resolved;
      case 'service-account':
        resolved.options = {
          ...((resolved.options ?? {}) as Record<string, unknown>),
          keyFilePath: credential.keyFilePath,
        };
        return resolved;
      case 'iam':
        resolved.options = {
          ...((resolved.options ?? {}) as Record<string, unknown>),
          awsProfile: credential.profile,
          roleArn: credential.roleArn,
        };
        return resolved;
      case 'dsn': {
        const parsed = parseMinimalDsn(connectionName, credential.dsn);
        return {
          ...resolved,
          ...parsed.config,
          options: {
            ...((resolved.options ?? {}) as Record<string, unknown>),
            ...((parsed.config.options ?? {}) as Record<string, unknown>),
          },
          password: parsed.passwordFromDsn ?? resolved.password,
        };
      }
    }
  }

  private registerBuiltInDrivers(registry: PluginRegistry): void {
    registry.registerFactory('sqlite', async () => {
      const { SqliteDriver } = await import('@maitredb/driver-sqlite');
      return new SqliteDriver();
    });

    registry.registerFactory('postgresql', async () => {
      const { PostgresDriver } = await import('@maitredb/driver-postgres');
      return new PostgresDriver();
    });

    registry.registerFactory('mysql', async () => {
      const { MysqlDriver } = await import('@maitredb/driver-mysql');
      return new MysqlDriver('mysql');
    });

    registry.registerFactory('mariadb', async () => {
      const { MysqlDriver } = await import('@maitredb/driver-mysql');
      return new MysqlDriver('mariadb');
    });

    registry.registerFactory('duckdb', async () => {
      const { DuckDbDriver } = await import('@maitredb/driver-duckdb');
      return new DuckDbDriver();
    });

    registry.registerFactory('clickhouse', async () => {
      const { ClickHouseDriver } = await import('@maitredb/driver-clickhouse');
      return new ClickHouseDriver();
    });

    registry.registerFactory('snowflake', async () => {
      const packageName = '@maitredb/driver-snowflake';
      const { SnowflakeDriver } = await import(packageName) as { SnowflakeDriver: new () => DriverAdapter };
      return new SnowflakeDriver();
    });

    registry.registerFactory('mongodb', async () => {
      const packageName = '@maitredb/driver-mongodb';
      const { MongoDbDriver } = await import(packageName) as { MongoDbDriver: new () => DriverAdapter };
      return new MongoDbDriver();
    });

    registry.registerFactory('bigquery', async () => {
      const packageName = '@maitredb/driver-bigquery';
      const { BigQueryDriver } = await import(packageName) as { BigQueryDriver: new () => DriverAdapter };
      return new BigQueryDriver();
    });

    registry.registerFactory('redshift', async () => {
      const packageName = '@maitredb/driver-redshift';
      const { RedshiftDriver } = await import(packageName) as { RedshiftDriver: new () => DriverAdapter };
      return new RedshiftDriver();
    });

    registry.registerFactory('athena', async () => {
      const packageName = '@maitredb/driver-athena';
      const { AthenaDriver } = await import(packageName) as { AthenaDriver: new () => DriverAdapter };
      return new AthenaDriver();
    });
  }
}

function sanitizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      next[key] = sanitizeValue(value);
    }
    return next;
  });
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (Array.isArray(value)) return value.map((entry) => sanitizeValue(entry));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = sanitizeValue(nested);
    }
    return next;
  }
  return value;
}

function parseMinimalDsn(name: string, dsn: string): { config: ConnectionConfig; passwordFromDsn?: string } {
  const url = new URL(dsn);
  const protocol = url.protocol.replace(/:$/, '');
  const type = protocolToDialect(protocol);
  const passwordFromDsn = url.password ? decodeURIComponent(url.password) : undefined;

  const config: ConnectionConfig = {
    name,
    type,
    host: url.hostname || undefined,
    port: url.port ? Number.parseInt(url.port, 10) : undefined,
    user: url.username ? decodeURIComponent(url.username) : undefined,
  };

  if (type === 'sqlite' || type === 'duckdb') {
    config.path = decodeURIComponent(url.pathname || ':memory:');
  } else {
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (database) config.database = database;
  }

  if (url.searchParams.size > 0) {
    const options: Record<string, unknown> = {};
    url.searchParams.forEach((value, key) => {
      options[key] = value;
    });
    config.options = options;
  }

  return { config, passwordFromDsn };
}

function protocolToDialect(protocol: string): ConnectionConfig['type'] {
  switch (protocol) {
    case 'postgres':
    case 'postgresql':
      return 'postgresql';
    case 'mysql':
      return 'mysql';
    case 'mariadb':
      return 'mariadb';
    case 'sqlite':
    case 'sqlite3':
      return 'sqlite';
    case 'duckdb':
      return 'duckdb';
    case 'clickhouse':
    case 'clickhouse+http':
    case 'clickhouse+https':
    case 'clickhouse+native':
      return 'clickhouse';
    case 'snowflake':
      return 'snowflake';
    case 'mongodb':
    case 'mongodb+srv':
      return 'mongodb';
    case 'bigquery':
    case 'bq':
      return 'bigquery';
    case 'redshift':
      return 'redshift';
    case 'athena':
      return 'athena';
    default:
      throw new MaitreError(9004, `Unsupported DSN protocol: ${protocol}`);
  }
}
