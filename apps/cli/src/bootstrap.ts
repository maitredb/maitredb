import { PluginRegistry } from '@maitredb/plugin-api';
import { ConfigManager, ConnectionManager, HistoryStore } from '@maitredb/core';
import { CacheManager, CachedAdapter } from '@maitredb/cache';
import { resolveConnectionConfig } from './connection-config.js';

let registry: PluginRegistry | undefined;
let configManager: ConfigManager | undefined;
let cacheManager: CacheManager | undefined;
let historyStore: HistoryStore | undefined;
let connectionManager: ConnectionManager | undefined;

/**
 * Resolve the singleton PluginRegistry used by the CLI.
 * Drivers are registered lazily so simply importing the CLI does not pull
 * every driver into memory.
 */
export function getRegistry(): PluginRegistry {
  if (!registry) {
    registry = new PluginRegistry();

    // Register built-in drivers lazily
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
      const { SnowflakeDriver } = await import(packageName) as { SnowflakeDriver: new () => import('@maitredb/plugin-api').DriverAdapter };
      return new SnowflakeDriver();
    });

    registry.registerFactory('mongodb', async () => {
      const packageName = '@maitredb/driver-mongodb';
      const { MongoDbDriver } = await import(packageName) as { MongoDbDriver: new () => import('@maitredb/plugin-api').DriverAdapter };
      return new MongoDbDriver();
    });

    registry.registerFactory('bigquery', async () => {
      const packageName = '@maitredb/driver-bigquery';
      const { BigQueryDriver } = await import(packageName) as { BigQueryDriver: new () => import('@maitredb/plugin-api').DriverAdapter };
      return new BigQueryDriver();
    });

    registry.registerFactory('redshift', async () => {
      const packageName = '@maitredb/driver-redshift';
      const { RedshiftDriver } = await import(packageName) as { RedshiftDriver: new () => import('@maitredb/plugin-api').DriverAdapter };
      return new RedshiftDriver();
    });

    registry.registerFactory('athena', async () => {
      const packageName = '@maitredb/driver-athena';
      const { AthenaDriver } = await import(packageName) as { AthenaDriver: new () => import('@maitredb/plugin-api').DriverAdapter };
      return new AthenaDriver();
    });
  }
  return registry;
}

/**
 * Resolve the singleton ConfigManager used by the CLI.
 */
export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager();
  }
  return configManager;
}

/**
 * Resolve the singleton CacheManager used for metadata caching.
 */
export function getCacheManager(): CacheManager {
  if (!cacheManager) {
    const cfg = getConfigManager().getConfig();
    cacheManager = new CacheManager(cfg.cache);
  }
  return cacheManager;
}

/**
 * Resolve the singleton HistoryStore used for query auditing.
 */
export function getHistoryStore(): HistoryStore {
  if (!historyStore) {
    const cfg = getConfigManager().getConfig();
    historyStore = new HistoryStore(cfg.history);
  }
  return historyStore;
}

/**
 * Resolve the singleton pool-aware ConnectionManager.
 */
export function getConnectionManager(): ConnectionManager {
  if (!connectionManager) {
    const cfgMgr = getConfigManager();
    const cache = getCacheManager();

    connectionManager = new ConnectionManager(getRegistry(), cfgMgr, {
      resolveConnection: (name) => resolveConnectionConfig(cfgMgr, name),
      wrapAdapter: (adapter) => (cache.isEnabled() ? new CachedAdapter(adapter, cache) : adapter),
    });
  }
  return connectionManager;
}
