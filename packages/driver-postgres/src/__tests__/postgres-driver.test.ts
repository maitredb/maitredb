import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresDriver } from '../index.js';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';

describe('PostgresDriver', () => {
  let driver: PostgresDriver;

  beforeAll(() => {
    driver = new PostgresDriver();
  });

  describe('capabilities', () => {
    it('returns correct PostgreSQL capabilities', () => {
      const caps = driver.capabilities();
      expect(caps.transactions).toBe(true);
      expect(caps.streaming).toBe(true);
      expect(caps.explain).toBe(true);
      expect(caps.explainAnalyze).toBe(true);
      expect(caps.procedures).toBe(true);
      expect(caps.roles).toBe(true);
      expect(caps.schemas).toBe(true);
      expect(caps.cancelQuery).toBe(true);
      expect(caps.listenNotify).toBe(true);
      expect(caps.asyncExecution).toBe(false);
      expect(caps.embedded).toBe(false);
      expect(caps.costEstimate).toBe(true);
    });
  });

  describe('type mapping', () => {
    const testCases = [
      ['integer', 'integer'],
      ['bigint', 'integer'],
      ['smallint', 'integer'],
      ['serial', 'integer'],
      ['float4', 'float'],
      ['float8', 'float'],
      ['double precision', 'float'],
      ['real', 'float'],
      ['numeric', 'decimal'],
      ['decimal', 'decimal'],
      ['money', 'decimal'],
      ['boolean', 'boolean'],
      ['bool', 'boolean'],
      ['date', 'date'],
      ['time', 'time'],
      ['timestamp', 'timestamp'],
      ['timestamptz', 'timestamp'],
      ['json', 'json'],
      ['jsonb', 'json'],
      ['bytea', 'binary'],
      ['uuid', 'uuid'],
      ['interval', 'interval'],
      ['text', 'string'],
      ['varchar', 'string'],
      ['char', 'string'],
      ['geometry', 'geometry'],
      ['geography', 'geometry'],
    ];

    testCases.forEach(([nativeType, expected]) => {
      it(`maps ${nativeType} to ${expected}`, () => {
        expect(driver.mapNativeType(nativeType)).toBe(expected);
      });
    });
  });

  describe('error handling', () => {
    it('throws CONNECTION_FAILED when not connected', async () => {
      const config = {
        host: 'nonexistent',
        port: 5432,
        user: 'test',
        database: 'test',
      };

      await expect(driver.testConnection(config))
        .resolves
        .toMatchObject({ success: false });
    });

    it('throws proper error for invalid operations when not connected', async () => {
      const mockConn = {} as any;
      
      await expect(driver.execute(mockConn, 'SELECT 1'))
        .rejects
        .toBeInstanceOf(MaitreError);
    });
  });

  describe('utility methods', () => {
    it('extracts index columns from definition', () => {
      const definition = 'CREATE INDEX idx_users_name ON users (name)';
      expect(driver['extractIndexColumns'](definition)).toEqual(['name']);
    });

    it('extracts multiple index columns', () => {
      const definition = 'CREATE INDEX idx_users_name_email ON users (name, email)';
      expect(driver['extractIndexColumns'](definition)).toEqual(['name', 'email']);
    });

    it('returns empty array for invalid index definition', () => {
      const definition = 'CREATE INDEX idx_users_name ON users';
      expect(driver['extractIndexColumns'](definition)).toEqual([]);
    });
  });
});