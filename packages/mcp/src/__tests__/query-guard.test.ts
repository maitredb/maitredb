import { describe, expect, it } from 'vitest';

import { isPotentiallyMutatingQuery } from '../query-guard.js';

describe('isPotentiallyMutatingQuery', () => {
  it('allows basic read-only selects', () => {
    expect(isPotentiallyMutatingQuery('SELECT 1')).toBe(false);
    expect(isPotentiallyMutatingQuery('  -- comment\nSELECT * FROM users')).toBe(false);
  });

  it('blocks mutating verbs', () => {
    expect(isPotentiallyMutatingQuery('DELETE FROM users')).toBe(true);
    expect(isPotentiallyMutatingQuery('UPDATE users SET name = \"x\"')).toBe(true);
    expect(isPotentiallyMutatingQuery('DROP TABLE users')).toBe(true);
  });

  it('blocks multi-statement payloads', () => {
    expect(isPotentiallyMutatingQuery('SELECT 1; SELECT 2')).toBe(true);
  });
});
