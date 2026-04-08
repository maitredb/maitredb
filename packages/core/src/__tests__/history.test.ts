import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HistoryStore } from '../history.js';
import { MaitreErrorCode } from '../errors.js';

function historyPath(): string {
  return join(tmpdir(), `mdb-history-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

describe('HistoryStore', () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const path of createdPaths.splice(0)) {
      if (existsSync(path)) {
        rmSync(path, { force: true });
      }
    }
  });

  it('records and queries entries with filters and limits', () => {
    const dbPath = historyPath();
    createdPaths.push(dbPath);

    const store = new HistoryStore({ dbPath, enabled: true, maxSizeMb: 100 });

    store.record({
      id: '1',
      timestamp: new Date('2026-04-08T10:00:00Z'),
      connection: 'dev',
      dialect: 'sqlite',
      caller: 'human',
      query: 'SELECT 1',
      durationMs: 2,
      rowsReturned: 1,
    });
    store.record({
      id: '2',
      timestamp: new Date('2026-04-08T11:00:00Z'),
      connection: 'prod',
      dialect: 'postgresql',
      caller: 'agent',
      query: 'SELECT * FROM users',
      durationMs: 5,
      params: ['alice@example.com'],
      error: {
        code: MaitreErrorCode.PERMISSION_DENIED,
        message: 'denied',
      },
    });

    const all = store.query({ last: 10 });
    expect(all).toHaveLength(2);
    expect(all[0]?.id).toBe('2');

    const filtered = store.query({ connection: 'dev', last: 5 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('1');

    store.close();
  });

  it('degrades gracefully when better-sqlite3 is unavailable', () => {
    const store = new HistoryStore({ enabled: true, databaseCtor: null });
    expect(store.isAvailable()).toBe(false);
    store.record({
      id: 'disabled',
      timestamp: new Date(),
      connection: 'dev',
      dialect: 'sqlite',
      caller: 'human',
      query: 'SELECT 1',
      durationMs: 1,
    });
    expect(store.query({ last: 5 })).toEqual([]);
  });

  it('rotates old rows when max size is exceeded', () => {
    const dbPath = historyPath();
    createdPaths.push(dbPath);

    const store = new HistoryStore({ dbPath, enabled: true, maxSizeMb: 100 });
    for (let i = 0; i < 20; i++) {
      store.record({
        id: String(i),
        timestamp: new Date(Date.now() + i),
        connection: 'dev',
        dialect: 'sqlite',
        caller: 'human',
        query: `SELECT ${i}`,
        durationMs: 1,
      });
    }

    const before = store.query({ last: 50 }).length;
    store.maybeRotate(0); // force rotation
    const after = store.query({ last: 50 }).length;

    expect(before).toBeGreaterThan(after);
    expect(after).toBeGreaterThan(0);
    store.close();
  });
});
