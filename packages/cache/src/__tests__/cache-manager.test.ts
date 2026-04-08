import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CacheManager } from '../cache-manager.js';

function cachePath(): string {
  return join(tmpdir(), `mdb-cache-manager-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

describe('CacheManager', () => {
  const paths: string[] = [];

  afterEach(() => {
    for (const path of paths.splice(0)) {
      if (existsSync(path)) rmSync(path, { force: true });
    }
  });

  it('supports memory set/get and scoped invalidation', async () => {
    const manager = new CacheManager({ diskEnabled: false });
    await manager.set('conn:postgresql:tables:public:*', [{ name: 'users' }], 1_000);
    await manager.set('conn:postgresql:grants:*:*', [{ role: 'r' }], 1_000);

    expect(await manager.get('conn:postgresql:tables:public:*')).toEqual([{ name: 'users' }]);
    await manager.invalidateForConnection('conn', 'postgresql', 'schema');
    expect(await manager.get('conn:postgresql:tables:public:*')).toBeUndefined();
    expect(await manager.get('conn:postgresql:grants:*:*')).toEqual([{ role: 'r' }]);
  });

  it('promotes disk-cached values to memory', async () => {
    const path = cachePath();
    paths.push(path);

    const writer = new CacheManager({ diskEnabled: true, diskPath: path });
    await writer.set('conn:sqlite:tables:main:*', [{ name: 'items' }], 60_000);
    writer.close();

    const reader = new CacheManager({ diskEnabled: true, diskPath: path });
    const firstRead = await reader.get<Array<{ name: string }>>('conn:sqlite:tables:main:*');
    const secondRead = await reader.get<Array<{ name: string }>>('conn:sqlite:tables:main:*');
    expect(firstRead).toEqual([{ name: 'items' }]);
    expect(secondRead).toEqual([{ name: 'items' }]);
    reader.close();
  });

  it('returns configured TTLs by scope', () => {
    const manager = new CacheManager({ diskEnabled: false, schemaTtlMs: 5_000, permissionTtlMs: 2_000 });
    expect(manager.ttlFor('schema')).toBe(5_000);
    expect(manager.ttlFor('permissions')).toBe(2_000);
  });
});
