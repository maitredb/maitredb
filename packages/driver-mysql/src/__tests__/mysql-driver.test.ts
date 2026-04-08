import { describe, expect, it } from 'vitest';
import { MysqlDriver } from '../index.js';

describe('MysqlDriver', () => {
  it('reports the expected capabilities', () => {
    const driver = new MysqlDriver('mysql');
    const capabilities = driver.capabilities();

    expect(capabilities.transactions).toBe(true);
    expect(capabilities.streaming).toBe(true);
    expect(capabilities.explain).toBe(true);
    expect(capabilities.explainAnalyze).toBe(true);
    expect(capabilities.procedures).toBe(true);
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
});
