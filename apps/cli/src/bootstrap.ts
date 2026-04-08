import { PluginRegistry } from '@maitredb/plugin-api';

let registry: PluginRegistry | undefined;

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
  }
  return registry;
}
