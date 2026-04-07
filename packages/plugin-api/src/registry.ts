import type { DatabaseDialect } from './types.js';
import type { DriverAdapter } from './driver-adapter.js';

type DriverFactory = () => Promise<DriverAdapter>;

/** Central registry that lazy-loads driver adapters on demand. */
export class PluginRegistry {
  private adapters = new Map<DatabaseDialect, DriverAdapter>();
  private factories = new Map<DatabaseDialect, DriverFactory>();

  /** Register a factory function that produces a driver when requested. */
  registerFactory(dialect: DatabaseDialect, factory: DriverFactory): void {
    this.factories.set(dialect, factory);
  }

  /** Register an already-instantiated adapter (useful for tests). */
  register(dialect: DatabaseDialect, adapter: DriverAdapter): void {
    this.adapters.set(dialect, adapter);
  }

  /** Resolve (and cache) the adapter for the requested dialect. */
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

  /** True when a driver or factory has been registered for the dialect. */
  has(dialect: DatabaseDialect): boolean {
    return this.adapters.has(dialect) || this.factories.has(dialect);
  }

  /** List of all dialects with registered adapters or factories. */
  get dialects(): DatabaseDialect[] {
    return [...new Set([...this.adapters.keys(), ...this.factories.keys()])];
  }
}
