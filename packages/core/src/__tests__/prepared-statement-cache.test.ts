import { describe, expect, it, vi } from 'vitest';
import { PreparedStatementCache, isPreparedStatementEligible, statementKey } from '../prepared-statement-cache.js';

describe('PreparedStatementCache', () => {
  it('normalizes SQL into stable cache keys', () => {
    expect(statementKey('SELECT *   FROM users WHERE id = $1')).toBe(statementKey(' SELECT * FROM users WHERE id = $1 '));
    expect(statementKey('SELECT * FROM users WHERE id = $2')).not.toBe(statementKey('SELECT * FROM users WHERE id = $1'));
  });

  it('rejects empty and multi-statement SQL while respecting semicolons in literals/comments', () => {
    expect(isPreparedStatementEligible('')).toBe(false);
    expect(isPreparedStatementEligible('SELECT 1; SELECT 2')).toBe(false);
    expect(isPreparedStatementEligible("SELECT ';' AS semi -- ;\n")).toBe(true);
    expect(isPreparedStatementEligible('SELECT $$;$$ AS semi')).toBe(true);
  });

  it('tracks uses and moves reused entries to the LRU tail', () => {
    const evicted: string[] = [];
    const cache = new PreparedStatementCache({
      maxSize: 2,
      prefix: 'test',
      onEvict: (statement) => {
        evicted.push(statement.sql);
      },
    });

    const first = cache.getOrCreate('SELECT 1');
    cache.getOrCreate('SELECT 2');
    const reused = cache.getOrCreate('SELECT 1');
    cache.getOrCreate('SELECT 3');

    expect(reused).toBe(first);
    expect(reused?.uses).toBe(2);
    expect(cache.has('SELECT 1')).toBe(true);
    expect(cache.has('SELECT 2')).toBe(false);
    expect(evicted).toEqual(['SELECT 2']);
  });

  it('disables caching cleanly when maxSize is zero', () => {
    const onEvict = vi.fn();
    const cache = new PreparedStatementCache({ maxSize: 0, onEvict });

    expect(cache.getOrCreate('SELECT 1')).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(onEvict).not.toHaveBeenCalled();
  });
});