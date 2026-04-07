import { describe, it, expect } from 'vitest';
import { getFormatter } from '../formatters.js';
import type { QueryResult } from '@maitredb/plugin-api';

const sampleResult: QueryResult = {
  rows: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@test.com' },
  ],
  fields: [
    { name: 'id', nativeType: 'INTEGER', type: 'integer' },
    { name: 'name', nativeType: 'TEXT', type: 'string' },
    { name: 'email', nativeType: 'TEXT', type: 'string' },
  ],
  rowCount: 2,
  durationMs: 1.5,
};

const emptyResult: QueryResult = {
  rows: [],
  fields: [{ name: 'id', nativeType: 'INTEGER', type: 'integer' }],
  rowCount: 0,
  durationMs: 0,
};

describe('formatters', () => {
  describe('json', () => {
    it('formats as pretty JSON', () => {
      const out = getFormatter('json').format(sampleResult);
      const parsed = JSON.parse(out);
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[0].name).toBe('Alice');
      expect(parsed).toHaveProperty('fields');
      expect(parsed).toHaveProperty('rowCount');
      expect(parsed).toHaveProperty('durationMs');
    });
  });

  describe('ndjson', () => {
    it('formats one JSON object per line', () => {
      const out = getFormatter('ndjson').format(sampleResult);
      const lines = out.split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]!).id).toBe(1);
      expect(JSON.parse(lines[1]!).id).toBe(2);
    });
  });

  describe('csv', () => {
    it('includes header and rows', () => {
      const out = getFormatter('csv').format(sampleResult);
      const lines = out.split('\n');
      expect(lines[0]).toBe('id,name,email');
      expect(lines[1]).toBe('1,Alice,alice@example.com');
    });

    it('escapes commas and quotes', () => {
      const result: QueryResult = {
        rows: [{ val: 'a,b', quoted: 'say "hi"' }],
        fields: [
          { name: 'val', nativeType: 'TEXT', type: 'string' },
          { name: 'quoted', nativeType: 'TEXT', type: 'string' },
        ],
        rowCount: 1,
        durationMs: 0,
      };
      const out = getFormatter('csv').format(result);
      expect(out).toContain('"a,b"');
      expect(out).toContain('"say ""hi"""');
    });
  });

  describe('table', () => {
    it('formats with borders and row count', () => {
      const out = getFormatter('table').format(sampleResult);
      expect(out).toContain('Alice');
      expect(out).toContain('(2 rows)');
      expect(out).toContain('│');
    });

    it('shows (0 rows) for empty result', () => {
      const out = getFormatter('table').format(emptyResult);
      expect(out).toBe('(0 rows) (0.00 ms)');
    });
  });

  describe('raw', () => {
    it('outputs tab-separated values without header', () => {
      const out = getFormatter('raw').format(sampleResult);
      const lines = out.split('\n');
      expect(lines[0]).toBe('1\tAlice\talice@example.com');
    });
  });
});
