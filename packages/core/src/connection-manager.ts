import type {
  Connection,
  ConnectionConfig,
  DatabaseDialect,
  DriverAdapter,
  PoolConfig,
} from '@maitredb/plugin-api';
import type { PluginRegistry } from '@maitredb/plugin-api';
import { ConfigManager } from './config.js';
import type { Credential } from './credentials.js';
import { MaitreError, MaitreErrorCode } from './errors.js';
import { GenericPool, type PoolStats } from './generic-pool.js';

const NATIVE_POOL_DIALECTS = new Set<DatabaseDialect>(['postgresql', 'mysql', 'mariadb']);

const DEFAULT_POOL_CONFIG: Required<PoolConfig> = {
  min: 0,
  max: 10,
  idleTimeoutMs: 30_000,
  acquireTimeoutMs: 10_000,
  maxWaitingClients: 20,
};

export interface ManagedConnection extends Connection {
  poolName: string;
  adapter: DriverAdapter;
  inTransaction: boolean;
  acquiredAt: number;
}

export interface ConnectionManagerOptions {
  resolveConnection?: (name: string) => Promise<ConnectionConfig>;
  wrapAdapter?: (adapter: DriverAdapter, connectionName: string) => DriverAdapter;
  nativePoolDialects?: Set<DatabaseDialect>;
}

interface NativePoolEntry {
  kind: 'native';
  adapter: DriverAdapter;
  config: ConnectionConfig;
  connection: Connection;
}

interface GenericPoolEntry {
  kind: 'generic';
  adapter: DriverAdapter;
  config: ConnectionConfig;
  pool: GenericPool<Connection>;
}

type PoolEntry = NativePoolEntry | GenericPoolEntry;

/**
 * Centralized connection lifecycle manager that supports native and generic pools.
 */
export class ConnectionManager {
  private readonly pools = new Map<string, PoolEntry>();

  constructor(
    private readonly registry: PluginRegistry,
    private readonly configManager: ConfigManager,
    private readonly options: ConnectionManagerOptions = {},
  ) {}

  /**
   * Acquire a managed connection by saved connection name.
   */
  async getConnection(name: string): Promise<ManagedConnection> {
    const entry = await this.getOrCreateEntry(name);

    if (entry.kind === 'native') {
      if (!(await entry.adapter.validateConnection(entry.connection))) {
        await entry.adapter.disconnect(entry.connection);
        entry.connection = await entry.adapter.connect(entry.config);
      }
      return this.toManagedConnection(entry.connection, name, entry.adapter);
    }

    let conn = await entry.pool.acquire();
    if (!(await entry.adapter.validateConnection(conn))) {
      await entry.pool.invalidate(conn);
      conn = await entry.pool.acquire();
    }
    return this.toManagedConnection(conn, name, entry.adapter);
  }

  /**
   * Release a managed connection.
   */
  async releaseConnection(conn: ManagedConnection): Promise<void> {
    const entry = this.pools.get(conn.poolName);
    if (!entry) {
      return;
    }

    if (entry.kind === 'generic') {
      await entry.pool.release(conn);
    }
  }

  /**
   * Close every managed pool/connection.
   */
  async closeAll(): Promise<void> {
    const entries = [...this.pools.values()];
    this.pools.clear();

    for (const entry of entries) {
      if (entry.kind === 'native') {
        await entry.adapter.disconnect(entry.connection);
      } else {
        await entry.pool.drain();
      }
    }
  }

  /**
   * Return pool counters for generic pools.
   */
  getPoolStats(name: string): PoolStats | undefined {
    const entry = this.pools.get(name);
    if (!entry || entry.kind === 'native') {
      return undefined;
    }
    return entry.pool.stats;
  }

  private async getOrCreateEntry(name: string): Promise<PoolEntry> {
    const existing = this.pools.get(name);
    if (existing) {
      return existing;
    }

    const config = await this.resolveConnection(name);
    const rawAdapter = await this.registry.get(config.type);
    const adapter = this.options.wrapAdapter ? this.options.wrapAdapter(rawAdapter, name) : rawAdapter;

    const nativePoolDialects = this.options.nativePoolDialects ?? NATIVE_POOL_DIALECTS;
    let entry: PoolEntry;

    if (nativePoolDialects.has(config.type)) {
      const connection = await adapter.connect(config);
      entry = {
        kind: 'native',
        adapter,
        config,
        connection,
      };
    } else {
      const pool = new GenericPool<Connection>(
        {
          create: async () => adapter.connect(config),
          destroy: async (resource) => adapter.disconnect(resource),
          validate: async (resource) => adapter.validateConnection(resource),
        },
        normalizePoolConfig(config.pool),
      );

      entry = {
        kind: 'generic',
        adapter,
        config,
        pool,
      };
    }

    this.pools.set(name, entry);
    return entry;
  }

  private toManagedConnection(conn: Connection, poolName: string, adapter: DriverAdapter): ManagedConnection {
    const managed = conn as ManagedConnection;
    managed.poolName = poolName;
    managed.adapter = adapter;
    managed.inTransaction = false;
    managed.acquiredAt = Date.now();
    return managed;
  }

  private async resolveConnection(name: string): Promise<ConnectionConfig> {
    if (this.options.resolveConnection) {
      return this.options.resolveConnection(name);
    }

    let config = this.cloneConfig(this.configManager.getConnection(name));
    const credential = await this.configManager.getCredential(name);

    if (credential?.kind === 'dsn') {
      const parsed = parseDsn(name, credential.dsn);
      config = this.mergeConfig(config, parsed.config);
      if (parsed.password) {
        config.password = parsed.password;
      }
      return config;
    }

    if (credential) {
      config = this.applyCredential(config, credential);
    }

    return config;
  }

  private cloneConfig(config: ConnectionConfig): ConnectionConfig {
    return {
      ...config,
      auth: config.auth ? [...config.auth] : undefined,
      tags: config.tags ? [...config.tags] : undefined,
      pool: config.pool ? { ...config.pool } : undefined,
      options: config.options ? { ...(config.options as Record<string, unknown>) } : undefined,
    };
  }

  private mergeConfig(base: ConnectionConfig, override: ConnectionConfig): ConnectionConfig {
    const mergedOptions = {
      ...((base.options ?? {}) as Record<string, unknown>),
      ...((override.options ?? {}) as Record<string, unknown>),
    };

    return {
      ...base,
      ...override,
      auth: override.auth ?? base.auth,
      tags: override.tags ?? base.tags,
      pool: {
        ...(base.pool ?? {}),
        ...(override.pool ?? {}),
      },
      options: Object.keys(mergedOptions).length > 0 ? mergedOptions : undefined,
    };
  }

  private applyCredential(config: ConnectionConfig, credential: Credential): ConnectionConfig {
    switch (credential.kind) {
      case 'password':
        return { ...config, password: credential.password };
      case 'token':
        return {
          ...config,
          options: {
            ...((config.options ?? {}) as Record<string, unknown>),
            accessToken: credential.accessToken,
            refreshToken: credential.refreshToken,
            expiresAt: credential.expiresAt,
            refreshExpiresAt: credential.refreshExpiresAt,
          },
        };
      case 'key-pair':
        return {
          ...config,
          options: {
            ...((config.options ?? {}) as Record<string, unknown>),
            privateKeyPath: credential.privateKeyPath,
            privateKeyPassphrase: credential.passphrase,
          },
        };
      case 'service-account':
        return {
          ...config,
          options: {
            ...((config.options ?? {}) as Record<string, unknown>),
            keyFilePath: credential.keyFilePath,
          },
        };
      case 'iam':
        return {
          ...config,
          options: {
            ...((config.options ?? {}) as Record<string, unknown>),
            awsProfile: credential.profile,
            roleArn: credential.roleArn,
          },
        };
      case 'dsn':
        return config;
    }
  }
}

function normalizePoolConfig(pool?: PoolConfig): Required<PoolConfig> {
  return {
    min: pool?.min ?? DEFAULT_POOL_CONFIG.min,
    max: pool?.max ?? DEFAULT_POOL_CONFIG.max,
    idleTimeoutMs: pool?.idleTimeoutMs ?? DEFAULT_POOL_CONFIG.idleTimeoutMs,
    acquireTimeoutMs: pool?.acquireTimeoutMs ?? DEFAULT_POOL_CONFIG.acquireTimeoutMs,
    maxWaitingClients: pool?.maxWaitingClients ?? DEFAULT_POOL_CONFIG.maxWaitingClients,
  };
}

function parseDsn(name: string, dsn: string): { config: ConnectionConfig; password?: string } {
  const url = new URL(dsn);
  const protocol = url.protocol.replace(/:$/, '');
  const type = toDialect(protocol);
  const password = url.password ? decodeURIComponent(url.password) : undefined;

  const config: ConnectionConfig = {
    name,
    type,
    host: url.hostname || undefined,
    port: url.port ? Number.parseInt(url.port, 10) : undefined,
    user: url.username ? decodeURIComponent(url.username) : undefined,
  };

  if (type === 'sqlite') {
    config.path = toSqlitePath(url);
  } else {
    config.database = decodeURIComponent(url.pathname.replace(/^\//, '') || '');
    if (config.database === '') {
      delete config.database;
    }
  }

  return { config, password };
}

function toDialect(protocol: string): ConnectionConfig['type'] {
  if (protocol === 'postgres' || protocol === 'postgresql') return 'postgresql';
  if (protocol === 'mysql') return 'mysql';
  if (protocol === 'mariadb') return 'mariadb';
  if (protocol === 'sqlite' || protocol === 'sqlite3') return 'sqlite';

  throw new MaitreError(
    MaitreErrorCode.CONFIG_ERROR,
    `Unsupported DSN protocol "${protocol}" in connection manager.`,
  );
}

function toSqlitePath(url: URL): string {
  if (url.pathname === '/:memory:' || (url.hostname === ':memory:' && (!url.pathname || url.pathname === '/'))) {
    return ':memory:';
  }
  if (url.hostname && (!url.pathname || url.pathname === '/')) {
    return decodeURIComponent(url.hostname);
  }
  return decodeURIComponent(url.pathname);
}
