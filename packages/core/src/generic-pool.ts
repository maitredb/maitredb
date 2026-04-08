import type { PoolConfig } from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from './errors.js';

export interface GenericPoolFactory<T> {
  create: () => Promise<T>;
  destroy: (resource: T) => Promise<void>;
  validate?: (resource: T) => Promise<boolean>;
}

interface Waiter<T> {
  resolve: (resource: T) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
}

interface IdleEntry<T> {
  resource: T;
  timeout?: NodeJS.Timeout;
}

export interface PoolStats {
  idle: number;
  active: number;
  waiting: number;
}

/**
 * Generic async pool used for drivers that do not provide native pool support.
 */
export class GenericPool<T> {
  private readonly idle: IdleEntry<T>[] = [];
  private readonly active = new Set<T>();
  private readonly waiting: Waiter<T>[] = [];
  private creating = 0;
  private draining = false;
  private ensuringMinIdle = false;

  constructor(
    private readonly factory: GenericPoolFactory<T>,
    private readonly config: Required<PoolConfig>,
  ) {
    void this.ensureMinIdle();
  }

  /**
   * Acquire a pooled resource, waiting up to `acquireTimeoutMs` if pool is saturated.
   */
  async acquire(): Promise<T> {
    if (this.draining) {
      throw new MaitreError(MaitreErrorCode.POOL_EXHAUSTED, 'Pool is draining and cannot accept new acquisitions.');
    }

    while (true) {
      if (this.draining) {
        throw new MaitreError(MaitreErrorCode.POOL_EXHAUSTED, 'Pool is draining and cannot accept new acquisitions.');
      }

      const fromIdle = await this.acquireFromIdle();
      if (fromIdle !== undefined) {
        return fromIdle;
      }

      if (this.totalCount < this.config.max) {
        return this.createAndActivate();
      }

      if (this.waiting.length >= this.config.maxWaitingClients) {
        throw new MaitreError(MaitreErrorCode.POOL_EXHAUSTED, 'Connection pool waiting queue is full.');
      }

      return this.waitForRelease();
    }
  }

  /**
   * Return a resource back to the pool.
   */
  async release(resource: T): Promise<void> {
    if (!this.active.delete(resource)) {
      return;
    }

    if (this.draining) {
      await this.destroyResource(resource);
      return;
    }

    const waiter = this.waiting.shift();
    if (waiter) {
      clearTimeout(waiter.timeout);
      this.active.add(resource);
      waiter.resolve(resource);
      return;
    }

    const entry: IdleEntry<T> = { resource };
    this.idle.push(entry);
    this.scheduleIdleDestroy(entry);
    void this.ensureMinIdle();
  }

  /**
   * Remove a resource from the pool immediately (for failed health checks).
   */
  async invalidate(resource: T): Promise<void> {
    if (this.active.delete(resource)) {
      await this.destroyResource(resource);
      return;
    }

    const index = this.idle.findIndex((entry) => entry.resource === resource);
    if (index >= 0) {
      const [entry] = this.idle.splice(index, 1);
      if (entry?.timeout) {
        clearTimeout(entry.timeout);
      }
      if (entry) {
        await this.destroyResource(entry.resource);
      }
    }
  }

  /**
   * Drain and close all resources in this pool.
   */
  async drain(): Promise<void> {
    this.draining = true;

    while (this.waiting.length > 0) {
      const waiter = this.waiting.shift();
      if (waiter) {
        clearTimeout(waiter.timeout);
        waiter.reject(new MaitreError(MaitreErrorCode.POOL_EXHAUSTED, 'Pool is draining.'));
      }
    }

    for (const entry of this.idle) {
      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }
    }

    const idleResources = this.idle.splice(0).map((entry) => entry.resource);
    const activeResources = [...this.active];
    this.active.clear();

    const settlements = await Promise.allSettled([
      ...idleResources.map((resource) => this.factory.destroy(resource)),
      ...activeResources.map((resource) => this.factory.destroy(resource)),
    ]);

    const rejection = settlements.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (rejection) {
      throw rejection.reason;
    }
  }

  /**
   * Current pool counters.
   */
  get stats(): PoolStats {
    return {
      idle: this.idle.length,
      active: this.active.size,
      waiting: this.waiting.length,
    };
  }

  private get totalCount(): number {
    return this.idle.length + this.active.size + this.creating;
  }

  private async acquireFromIdle(): Promise<T | undefined> {
    while (this.idle.length > 0) {
      const entry = this.idle.pop();
      if (!entry) return undefined;

      if (entry.timeout) {
        clearTimeout(entry.timeout);
      }

      if (this.factory.validate) {
        const valid = await this.factory.validate(entry.resource);
        if (!valid) {
          await this.destroyResource(entry.resource);
          continue;
        }
      }

      this.active.add(entry.resource);
      void this.ensureMinIdle();
      return entry.resource;
    }

    return undefined;
  }

  private async createAndActivate(): Promise<T> {
    if (this.draining) {
      throw new MaitreError(MaitreErrorCode.POOL_EXHAUSTED, 'Pool is draining and cannot create new resources.');
    }

    this.creating += 1;
    try {
      const resource = await this.factory.create();
      if (this.draining) {
        await this.factory.destroy(resource);
        throw new MaitreError(MaitreErrorCode.POOL_EXHAUSTED, 'Pool began draining during resource creation.');
      }
      this.active.add(resource);
      return resource;
    } finally {
      this.creating -= 1;
      void this.ensureMinIdle();
    }
  }

  private async destroyResource(resource: T): Promise<void> {
    try {
      await this.factory.destroy(resource);
    } finally {
      void this.ensureMinIdle();
    }
  }

  private waitForRelease(): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waiting.findIndex((waiter) => waiter.reject === reject);
        if (index >= 0) {
          this.waiting.splice(index, 1);
        }
        reject(new MaitreError(MaitreErrorCode.POOL_EXHAUSTED, 'Timed out waiting for a pooled connection.'));
      }, this.config.acquireTimeoutMs);
      timeout.unref?.();

      this.waiting.push({ resolve, reject, timeout });
    });
  }

  private scheduleIdleDestroy(entry: IdleEntry<T>): void {
    if (this.config.idleTimeoutMs <= 0) {
      return;
    }

    entry.timeout = setTimeout(() => {
      const index = this.idle.indexOf(entry);
      if (index < 0) {
        return;
      }
      if (this.idle.length <= this.config.min) {
        return;
      }

      this.idle.splice(index, 1);
      void this.destroyResource(entry.resource);
    }, this.config.idleTimeoutMs);
    entry.timeout.unref?.();
  }

  private async ensureMinIdle(): Promise<void> {
    if (this.draining || this.ensuringMinIdle) {
      return;
    }

    this.ensuringMinIdle = true;
    try {
      while (!this.draining && this.idle.length + this.creating < this.config.min && this.totalCount < this.config.max) {
        this.creating += 1;
        try {
          const resource = await this.factory.create();
          const waiter = this.waiting.shift();
          if (waiter) {
            clearTimeout(waiter.timeout);
            this.active.add(resource);
            waiter.resolve(resource);
          } else {
            const entry: IdleEntry<T> = { resource };
            this.idle.push(entry);
            this.scheduleIdleDestroy(entry);
          }
        } catch {
          break;
        } finally {
          this.creating -= 1;
        }
      }
    } finally {
      this.ensuringMinIdle = false;
    }
  }
}
