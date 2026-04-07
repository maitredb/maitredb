import type { DatabaseDialect } from './types.js';
import type { DriverAdapter } from './driver-adapter.js';

type DriverFactory = () => Promise<DriverAdapter>;

export class PluginRegistry {
  private adapters = new Map<DatabaseDialect, DriverAdapter>();
  private factories = new Map<DatabaseDialect, DriverFactory>();

  registerFactory(dialect: DatabaseDialect, factory: DriverFactory): void {
    this.factories.set(dialect, factory);
  }

  register(dialect: DatabaseDialect, adapter: DriverAdapter): void {
    this.adapters.set(dialect, adapter);
  }

  async get(dialect: DatabaseDialect): Promise<DriverAdapter> {
    const cached = this.adapters.get(dialect);
    if (cached) return cached;

    const factory = this.factories.get(dialect);
    if (!factory) {
      throw new Error(`No driver registered for dialect: ${dialect}`);
    }

    const adapter = await factory();
    this.adapters.set(dialect, adapter);
    return adapter;
  }

  has(dialect: DatabaseDialect): boolean {
    return this.adapters.has(dialect) || this.factories.has(dialect);
  }

  get dialects(): DatabaseDialect[] {
    return [...new Set([...this.adapters.keys(), ...this.factories.keys()])];
  }
}
