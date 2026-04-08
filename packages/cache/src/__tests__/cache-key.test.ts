import { describe, expect, it } from 'vitest';
import { buildCacheKey, invalidationPattern } from '../cache-key.js';

describe('cache-key helpers', () => {
  it('builds stable cache keys', () => {
    expect(buildCacheKey('conn1', 'postgresql', 'tables', 'public', 'users'))
      .toBe('conn1:postgresql:tables:public:users');
    expect(buildCacheKey('conn1', 'postgresql', 'tables'))
      .toBe('conn1:postgresql:tables:*:*');
  });

  it('creates invalidation regex by scope', () => {
    const schemaPattern = invalidationPattern('conn1', 'postgresql', 'schema');
    const permsPattern = invalidationPattern('conn1', 'postgresql', 'permissions');
    const allPattern = invalidationPattern('conn1', 'postgresql', 'all');

    expect(schemaPattern.test('conn1:postgresql:tables:public:*')).toBe(true);
    expect(schemaPattern.test('conn1:postgresql:grants:*:*')).toBe(false);
    expect(permsPattern.test('conn1:postgresql:roles:*:*')).toBe(true);
    expect(permsPattern.test('conn1:postgresql:columns:public:users')).toBe(false);
    expect(allPattern.test('conn1:postgresql:anything:*:*')).toBe(true);
  });
});
