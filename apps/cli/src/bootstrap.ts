import { PluginRegistry } from '@maitredb/plugin-api';

let registry: PluginRegistry | undefined;

export function getRegistry(): PluginRegistry {
  if (!registry) {
    registry = new PluginRegistry();

    // Register built-in drivers lazily
    registry.registerFactory('sqlite', async () => {
      const { SqliteDriver } = await import('@maitredb/driver-sqlite');
      return new SqliteDriver();
    });
  }
  return registry;
}
