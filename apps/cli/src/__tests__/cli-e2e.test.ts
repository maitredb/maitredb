import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);

const CLI = join(fileURLToPath(import.meta.url), '..', '..', '..', 'dist', 'cli.js');
const TEST_HOME = join(tmpdir(), `mdb-e2e-${Date.now()}`);
const DB_PATH = join(TEST_HOME, 'test.db');

function mdb(...args: string[]): Promise<{ stdout: string; stderr: string }> {
  return exec('node', [CLI, ...args], {
    env: { ...process.env, HOME: TEST_HOME },
    timeout: 10000,
  });
}

describe('CLI e2e', () => {
  beforeAll(() => {
    mkdirSync(TEST_HOME, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_HOME)) rmSync(TEST_HOME, { recursive: true });
  });

  it('shows version', async () => {
    const { stdout } = await mdb('--version');
    expect(stdout.trim()).toBe('0.0.1');
  });

  it('shows help', async () => {
    const { stdout } = await mdb('--help');
    expect(stdout).toContain('connect');
    expect(stdout).toContain('query');
    expect(stdout).toContain('schema');
  });

  it('add, list, test, and remove a connection', async () => {
    // Add
    const { stdout: addOut } = await mdb('connect', 'add', 'e2e', '--type', 'sqlite', '--path', DB_PATH);
    expect(addOut).toContain('saved');

    // List
    const { stdout: listOut } = await mdb('connect', 'list');
    expect(listOut).toContain('e2e');
    expect(listOut).toContain('sqlite');

    // Test
    const { stdout: testOut } = await mdb('connect', 'test', 'e2e');
    expect(testOut).toContain('OK');

    // Remove
    const { stdout: rmOut } = await mdb('connect', 'remove', 'e2e');
    expect(rmOut).toContain('removed');
  });

  describe('query and schema (with data)', () => {
    beforeAll(async () => {
      await mdb('connect', 'add', 'qdb', '--type', 'sqlite', '--path', DB_PATH);
      await mdb('query', 'qdb', 'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT, price REAL)');
      await mdb('query', 'qdb', "INSERT INTO items VALUES (1, 'Widget', 9.99), (2, 'Gadget', 24.50)");
    });

    it('query with table format', async () => {
      const { stdout } = await mdb('query', 'qdb', 'SELECT * FROM items ORDER BY id', '--format', 'table');
      expect(stdout).toContain('Widget');
      expect(stdout).toContain('Gadget');
      expect(stdout).toContain('(2 rows)');
    });

    it('query with json format', async () => {
      const { stdout } = await mdb('query', 'qdb', 'SELECT * FROM items ORDER BY id', '--format', 'json');
      const result = JSON.parse(stdout);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].name).toBe('Widget');
      expect(result).toHaveProperty('fields');
      expect(result).toHaveProperty('rowCount');
      expect(result).toHaveProperty('durationMs');
    });

    it('query with csv format', async () => {
      const { stdout } = await mdb('query', 'qdb', 'SELECT * FROM items ORDER BY id', '--format', 'csv');
      expect(stdout).toContain('id,name,price');
      expect(stdout).toContain('1,Widget,9.99');
    });

    it('query with ndjson format', async () => {
      const { stdout } = await mdb('query', 'qdb', 'SELECT * FROM items ORDER BY id', '--format', 'ndjson');
      const lines = stdout.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!).name).toBe('Widget');
    });

    it('query with parameterized WHERE', async () => {
      const { stdout } = await mdb('query', 'qdb', 'SELECT * FROM items WHERE price > 10', '--format', 'json');
      const result = JSON.parse(stdout);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Gadget');
    });

    it('schema tables', async () => {
      const { stdout } = await mdb('schema', 'qdb', 'tables', '--format', 'json');
      const result = JSON.parse(stdout);
      expect(result.rows.some((t: { name: string }) => t.name === 'items')).toBe(true);
    });

    it('schema columns', async () => {
      const { stdout } = await mdb('schema', 'qdb', 'columns', 'items', '--format', 'json');
      const result = JSON.parse(stdout);
      expect(result.rows).toHaveLength(3);
      expect(result.rows.find((c: { name: string }) => c.name === 'id')).toBeTruthy();
    });
  });

  it('returns error for missing connection', async () => {
    try {
      await mdb('query', 'nonexistent', 'SELECT 1');
      expect.unreachable('should have thrown');
    } catch (err: unknown) {
      const e = err as { stderr: string; code: number };
      expect(e.stderr).toContain('CONNECTION_FAILED');
    }
  });
});
