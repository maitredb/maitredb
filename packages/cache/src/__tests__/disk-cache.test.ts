import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DiskCache } from '../disk-cache.js';

function cachePath(): string {
  return join(tmpdir(), `mdb-cache-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

describe('DiskCache', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const path of paths.splice(0)) {
      if (existsSync(path)) rmSync(path, { force: true });
    }
  });

  it('stores and retrieves values on disk', () => {
    const path = cachePath();
    paths.push(path);

    const cache = new DiskCache(path);
    if (!cache.isAvailable()) {
      return;
    }

    cache.set('conn:pg:tables:*:*', [{ name: 'users' }], 1_000);
    const value = cache.get<Array<{ name: string }>>('conn:pg:tables:*:*');
    expect(value?.value).toEqual([{ name: 'users' }]);

    expect(cache.invalidate('conn:pg:tables')).toBe(1);
    expect(cache.get('conn:pg:tables:*:*')).toBeUndefined();
    cache.close();
  });

  it('invalidates by regex', () => {
    const path = cachePath();
    paths.push(path);

    const cache = new DiskCache(path);
    if (!cache.isAvailable()) {
      return;
    }

    cache.set('a:tables:*:*', [1], 1_000);
    cache.set('a:grants:*:*', [2], 1_000);
    const removed = cache.invalidateByRegex(/^a:tables:/);
    expect(removed).toBe(1);
    expect(cache.get('a:tables:*:*')).toBeUndefined();
    expect(cache.get('a:grants:*:*')?.value).toEqual([2]);
    cache.close();
  });

  it('degrades gracefully when better-sqlite3 is unavailable', () => {
    const cache = new DiskCache(cachePath(), null);
    expect(cache.isAvailable()).toBe(false);
    cache.set('k', 'v', 1_000);
    expect(cache.get('k')).toBeUndefined();
    expect(cache.invalidate('k')).toBe(0);
    expect(cache.invalidateByRegex(/.*/)).toBe(0);
    cache.clear();
    cache.close();
  });
});
