import { describe, expect, it } from 'vitest';
import { parseDsn } from '../dsn.js';

describe('parseDsn', () => {
  it('parses PostgreSQL DSN into config + password', () => {
    const parsed = parseDsn('pg-prod', 'postgresql://alice:s3cret@db.example.com/app?sslmode=require&application_name=mdb');

    expect(parsed.password).toBe('s3cret');
    expect(parsed.config).toMatchObject({
      name: 'pg-prod',
      type: 'postgresql',
      host: 'db.example.com',
      port: 5432,
      user: 'alice',
      database: 'app',
      ssl: true,
    });

    const options = parsed.config.options as Record<string, unknown>;
    expect(options['applicationName']).toBe('mdb');
  });

  it('parses MySQL DSN with default port and typed options', () => {
    const parsed = parseDsn('mysql-dev', 'mysql://bob:pw@localhost/shop?charset=utf8mb4&multipleStatements=true');

    expect(parsed.password).toBe('pw');
    expect(parsed.config).toMatchObject({
      name: 'mysql-dev',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      user: 'bob',
      database: 'shop',
    });

    const options = parsed.config.options as Record<string, unknown>;
    expect(options['charset']).toBe('utf8mb4');
    expect(options['multipleStatements']).toBe(true);
  });

  it('parses MariaDB DSN as mariadb dialect', () => {
    const parsed = parseDsn('maria-dev', 'mariadb://svc@maria.internal/erp');

    expect(parsed.password).toBeUndefined();
    expect(parsed.config).toMatchObject({
      name: 'maria-dev',
      type: 'mariadb',
      host: 'maria.internal',
      port: 3306,
      user: 'svc',
      database: 'erp',
    });
  });

  it('parses sqlite in-memory and file DSNs', () => {
    const memory = parseDsn('sqlite-memory', 'sqlite:///:memory:');
    expect(memory.config).toMatchObject({
      name: 'sqlite-memory',
      type: 'sqlite',
      path: ':memory:',
    });

    const file = parseDsn('sqlite-file', 'sqlite:///tmp/maitredb-test.db');
    expect(file.config).toMatchObject({
      name: 'sqlite-file',
      type: 'sqlite',
      path: '/tmp/maitredb-test.db',
    });
  });

  it('rejects unknown DSN protocols', () => {
    expect(() => parseDsn('bad', 'oracle://user:pass@db/service')).toThrow('Unrecognized DSN protocol');
  });
});
