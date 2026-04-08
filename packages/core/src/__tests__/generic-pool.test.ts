import { describe, expect, it } from 'vitest';
import { GenericPool } from '../generic-pool.js';
import { MaitreErrorCode } from '../errors.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GenericPool', () => {
  it('enforces max connections and wait queue limits', async () => {
    let nextId = 0;
    const pool = new GenericPool(
      {
        create: async () => ({ id: ++nextId }),
        destroy: async () => {},
        validate: async () => true,
      },
      {
        min: 0,
        max: 1,
        idleTimeoutMs: 100,
        acquireTimeoutMs: 25,
        maxWaitingClients: 1,
      },
    );

    const first = await pool.acquire();
    const waitingAcquire = pool.acquire();
    await expect(pool.acquire()).rejects.toMatchObject({ code: MaitreErrorCode.POOL_EXHAUSTED });
    await expect(waitingAcquire).rejects.toMatchObject({ code: MaitreErrorCode.POOL_EXHAUSTED });

    await pool.release(first);
    await pool.drain();
  });

  it('invalidates failed resources and replaces them on acquire', async () => {
    let nextId = 0;
    const destroyed: number[] = [];

    const pool = new GenericPool<{ id: number }>(
      {
        create: async () => ({ id: ++nextId }),
        destroy: async (resource) => {
          destroyed.push(resource.id);
        },
        validate: async (resource) => resource.id !== 1,
      },
      {
        min: 1,
        max: 2,
        idleTimeoutMs: 100,
        acquireTimeoutMs: 100,
        maxWaitingClients: 2,
      },
    );

    await sleep(10); // allow min-idle bootstrap
    const acquired = await pool.acquire();
    expect(acquired.id).toBe(2);
    expect(destroyed).toContain(1);

    await pool.release(acquired);
    await pool.drain();
  });

  it('cleans up idle resources beyond the configured minimum', async () => {
    let nextId = 0;
    const destroyed: number[] = [];

    const pool = new GenericPool<{ id: number }>(
      {
        create: async () => ({ id: ++nextId }),
        destroy: async (resource) => {
          destroyed.push(resource.id);
        },
      },
      {
        min: 1,
        max: 3,
        idleTimeoutMs: 20,
        acquireTimeoutMs: 100,
        maxWaitingClients: 3,
      },
    );

    await sleep(10); // seed one idle resource for min
    const a = await pool.acquire();
    const b = await pool.acquire();
    await pool.release(a);
    await pool.release(b);

    expect(pool.stats.idle).toBeGreaterThanOrEqual(2);
    await sleep(40);
    expect(pool.stats.idle).toBe(1);
    expect(destroyed.length).toBeGreaterThanOrEqual(1);

    await pool.drain();
  });

  it('drains active and waiting resources', async () => {
    let nextId = 0;
    let destroyed = 0;

    const pool = new GenericPool<{ id: number }>(
      {
        create: async () => ({ id: ++nextId }),
        destroy: async () => {
          destroyed += 1;
        },
      },
      {
        min: 0,
        max: 1,
        idleTimeoutMs: 100,
        acquireTimeoutMs: 200,
        maxWaitingClients: 2,
      },
    );

    await pool.acquire();
    const waiting = pool.acquire();

    await pool.drain();

    await expect(waiting).rejects.toMatchObject({ code: MaitreErrorCode.POOL_EXHAUSTED });
    expect(destroyed).toBe(1);
  });
});
