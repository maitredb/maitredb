import { describe, expect, it, vi } from 'vitest';
import type { Connection } from '@maitredb/plugin-api';
import { MysqlDriver } from '../index.js';

class MockMysqlPromisePool {
  readonly execute = vi.fn(async () => [[{ id: 1 }], [{ name: 'id', columnType: 3, flags: 1 }]]);
  readonly query = vi.fn(async () => [[{ id: 1 }], [{ name: 'id', columnType: 3, flags: 1 }]]);
}

class MockMysqlPool {
  readonly promisePool = new MockMysqlPromisePool();
  promise() {
    return this.promisePool;
  }
}

function asConnection(pool: MockMysqlPool, options: Record<string, unknown> = {}): Connection {
  return {
    id: 'mysql-conn',
    dialect: 'mysql',
    config: { name: 'mysql', type: 'mysql', options },
    native: pool,
  };
}

describe('MysqlDriver', () => {
  it('reports the expected capabilities', () => {
    const driver = new MysqlDriver('mysql');
    const capabilities = driver.capabilities();

    expect(capabilities.transactions).toBe(true);
    expect(capabilities.streaming).toBe(true);
    expect(capabilities.explain).toBe(true);
    expect(capabilities.explainAnalyze).toBe(true);
    expect(capabilities.procedures).toBe(true);
    expect(capabilities.userDefinedTypes).toBe(false);
    expect(capabilities.roles).toBe(true);
    expect(capabilities.schemas).toBe(true);
    expect(capabilities.cancelQuery).toBe(true);
    expect(capabilities.listenNotify).toBe(false);
    expect(capabilities.asyncExecution).toBe(false);
    expect(capabilities.embedded).toBe(false);
  });

  it('maps MySQL and MariaDB native types to Maitre types', () => {
    const driver = new MysqlDriver('mariadb');

    expect(driver.mapNativeType('int')).toBe('integer');
    expect(driver.mapNativeType('tinyint(1)')).toBe('boolean');
    expect(driver.mapNativeType('decimal(12,2)')).toBe('decimal');
    expect(driver.mapNativeType('double')).toBe('float');
    expect(driver.mapNativeType('date')).toBe('date');
    expect(driver.mapNativeType('time')).toBe('time');
    expect(driver.mapNativeType('datetime')).toBe('datetime');
    expect(driver.mapNativeType('timestamp')).toBe('timestamp');
    expect(driver.mapNativeType('json')).toBe('json');
    expect(driver.mapNativeType('varchar(255)')).toBe('string');
    expect(driver.mapNativeType('blob')).toBe('binary');
    expect(driver.mapNativeType('geometry')).toBe('geometry');
    expect(driver.mapNativeType('custom_type')).toBe('unknown');
  });

  it('returns no standalone user-defined types', async () => {
    const driver = new MysqlDriver('mysql');
    await expect(driver.getTypes({} as never)).resolves.toEqual([]);
  });

  it('uses mysql2 execute for eligible parameterized statements', async () => {
    const driver = new MysqlDriver('mysql');
    const pool = new MockMysqlPool();

    const result = await driver.execute(asConnection(pool), 'SELECT * FROM users WHERE id = ?', [1]);

    expect(pool.promisePool.execute).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    expect(pool.promisePool.query).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      rowCount: 1,
      rows: [{ id: 1 }],
      fields: [{ name: 'id', nativeType: '3', type: 'integer', nullable: false }],
    });
  });

  it('uses query fallback when prepared caching is disabled or SQL is not eligible', async () => {
    const driver = new MysqlDriver('mysql');
    const disabledPool = new MockMysqlPool();
    const multiPool = new MockMysqlPool();

    await driver.execute(
      asConnection(disabledPool, { cachePreparedStatements: false }),
      'SELECT * FROM users WHERE id = ?',
      [1],
    );
    await driver.execute(asConnection(multiPool), 'SELECT ?; SELECT ?', [1, 2]);

    expect(disabledPool.promisePool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    expect(disabledPool.promisePool.execute).not.toHaveBeenCalled();
    expect(multiPool.promisePool.query).toHaveBeenCalledWith('SELECT ?; SELECT ?', [1, 2]);
    expect(multiPool.promisePool.execute).not.toHaveBeenCalled();
  });
});
