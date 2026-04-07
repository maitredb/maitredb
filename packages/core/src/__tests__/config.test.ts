import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigManager } from '../config.js';

describe('ConfigManager', () => {
  const testDir = join(tmpdir(), `mdb-test-config-${Date.now()}`);
  const homeDir = join(testDir, 'home', '.maitredb');
  let originalHome: string | undefined;

  beforeEach(() => {
    mkdirSync(homeDir, { recursive: true });
    originalHome = process.env['HOME'];
    process.env['HOME'] = join(testDir, 'home');
  });

  afterEach(() => {
    process.env['HOME'] = originalHome;
    delete process.env['MDB_DEFAULT_FORMAT'];
    delete process.env['MDB_MAX_ROWS'];
    if (existsSync(testDir)) rmSync(testDir, { recursive: true });
  });

  it('returns defaults when no config exists', () => {
    const mgr = new ConfigManager();
    const cfg = mgr.getConfig();
    expect(cfg.defaultFormat).toBe('table');
    expect(cfg.maxRows).toBe(10000);
  });

  it('env vars override defaults', () => {
    process.env['MDB_DEFAULT_FORMAT'] = 'json';
    process.env['MDB_MAX_ROWS'] = '500';
    const mgr = new ConfigManager();
    const cfg = mgr.getConfig();
    expect(cfg.defaultFormat).toBe('json');
    expect(cfg.maxRows).toBe(500);
  });

  it('CLI overrides take precedence', () => {
    process.env['MDB_DEFAULT_FORMAT'] = 'json';
    const mgr = new ConfigManager();
    const cfg = mgr.getConfig({ defaultFormat: 'csv' });
    expect(cfg.defaultFormat).toBe('csv');
  });

  it('saves and retrieves connections', () => {
    const mgr = new ConfigManager();
    mgr.saveConnection('mydb', {
      name: 'mydb',
      type: 'sqlite',
      path: '/tmp/test.db',
    });
    const conn = mgr.getConnection('mydb');
    expect(conn.type).toBe('sqlite');
    expect(conn.path).toBe('/tmp/test.db');
  });

  it('throws for missing connection', () => {
    const mgr = new ConfigManager();
    expect(() => mgr.getConnection('nope')).toThrow('Connection "nope" not found');
  });

  it('removes connections', () => {
    const mgr = new ConfigManager();
    mgr.saveConnection('tmp', { name: 'tmp', type: 'sqlite', path: ':memory:' });
    expect(mgr.removeConnection('tmp')).toBe(true);
    expect(mgr.removeConnection('tmp')).toBe(false);
  });
});
