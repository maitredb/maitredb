import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigManager } from '@maitredb/core';
import { resolveConnectionConfig } from '../connection-config.js';

describe('resolveConnectionConfig', () => {
  const testRoot = join(tmpdir(), `mdb-conn-resolve-${Date.now()}`);
  const homeDir = join(testRoot, 'home');
  let originalHome: string | undefined;

  beforeEach(() => {
    mkdirSync(homeDir, { recursive: true });
    originalHome = process.env['HOME'];
    process.env['HOME'] = homeDir;
  });

  afterEach(() => {
    process.env['HOME'] = originalHome;
    delete process.env['MDB_CONN_ENV_ONLY_DSN'];

    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('hydrates saved connection with password credential', async () => {
    const mgr = new ConfigManager();
    mgr.saveConnection('analytics', {
      name: 'analytics',
      type: 'mysql',
      host: 'localhost',
      database: 'app',
      user: 'alice',
    });
    await mgr.storeCredential('analytics', { kind: 'password', password: 'top-secret' });

    const resolved = await resolveConnectionConfig(mgr, 'analytics');

    expect(resolved.host).toBe('localhost');
    expect(resolved.database).toBe('app');
    expect(resolved.password).toBe('top-secret');
  });

  it('supports DSN-only connections from environment credentials', async () => {
    process.env['MDB_CONN_ENV_ONLY_DSN'] = 'mysql://svc:pw@db.internal/warehouse';

    const mgr = new ConfigManager();
    const resolved = await resolveConnectionConfig(mgr, 'env-only');

    expect(resolved).toMatchObject({
      name: 'env-only',
      type: 'mysql',
      host: 'db.internal',
      database: 'warehouse',
      user: 'svc',
      port: 3306,
      password: 'pw',
    });
  });
});
