import { describe, expect, it } from 'vitest';
import { MemoryCache } from '../memory-cache.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('MemoryCache', () => {
  it('stores and retrieves values with hit/miss stats', () => {
    const cache = new MemoryCache(10);
    cache.set('k1', { ok: true }, 1_000);

    expect(cache.get<{ ok: boolean }>('k1')).toEqual({ ok: true });
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.stats).toEqual({ hits: 1, misses: 1 });
  });

  it('expires values by TTL', async () => {
    const cache = new MemoryCache(10);
    cache.set('k1', 'value', 10);
    await sleep(20);
    expect(cache.get('k1')).toBeUndefined();
  });

  it('invalidates by regex and clears all entries', () => {
    const cache = new MemoryCache(10);
    cache.set('conn:pg:tables:*:*', [1], 1_000);
    cache.set('conn:pg:grants:*:*', [2], 1_000);

    const removed = cache.invalidate(/^conn:pg:tables:/);
    expect(removed).toBe(1);
    expect(cache.get('conn:pg:tables:*:*')).toBeUndefined();
    expect(cache.get('conn:pg:grants:*:*')).toEqual([2]);

    cache.clear();
    expect(cache.get('conn:pg:grants:*:*')).toBeUndefined();
  });
});
