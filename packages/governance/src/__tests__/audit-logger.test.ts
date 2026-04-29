import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { MaitreErrorCode } from '@maitredb/core';
import { AuditLogger, redactObviousSecretLiterals } from '../audit-logger.js';

function auditPath(): string {
  return join(tmpdir(), `mdb-audit-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

describe('AuditLogger', () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const path of createdPaths.splice(0)) {
      if (existsSync(path)) rmSync(path, { force: true });
    }
  });

  it('records allowed and blocked operations into a queryable audit_log table', () => {
    const dbPath = auditPath();
    createdPaths.push(dbPath);
    const logger = new AuditLogger({ dbPath });

    logger.record({
      id: 'allowed-1',
      timestamp: new Date('2026-04-29T10:00:00Z'),
      connection: 'prod',
      agentId: 'cursor-v1',
      query: 'SELECT * FROM users',
      classificationType: 'read',
      operation: 'SELECT',
      policyName: 'agent-default',
      allowed: true,
      affectedRows: 2,
    });
    logger.record({
      id: 'blocked-1',
      timestamp: new Date('2026-04-29T10:01:00Z'),
      connection: 'prod',
      agentId: 'cursor-v1',
      query: "DROP DATABASE prod WITH password='secret'",
      classificationType: 'ddl',
      operation: 'DROP',
      policyName: 'agent-default',
      allowed: false,
      blockedReason: 'DROP operations are not allowed for agents',
      errorCode: MaitreErrorCode.OPERATION_BLOCKED,
    });

    const blocked = logger.query({ agentId: 'cursor-v1', blockedOnly: true });
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.operation).toBe('DROP');
    expect(blocked[0]?.query).toContain('password=[REDACTED]');

    logger.close();
  });

  it('makes audit_log append-only with triggers', () => {
    const dbPath = auditPath();
    createdPaths.push(dbPath);
    const logger = new AuditLogger({ dbPath });
    logger.record({
      id: 'blocked-1',
      timestamp: new Date(),
      connection: 'prod',
      query: 'DROP TABLE users',
      operation: 'DROP',
      allowed: false,
      blockedReason: 'blocked',
      errorCode: MaitreErrorCode.OPERATION_BLOCKED,
    });
    logger.close();

    const db = new Database(dbPath);
    expect(() => db.prepare('DELETE FROM audit_log').run()).toThrow(/append-only/);
    expect(() => db.prepare("UPDATE audit_log SET allowed = 1 WHERE id = 'blocked-1'").run()).toThrow(/append-only/);
    db.close();
  });

  it('redacts obvious inline secret literals before persistence', () => {
    expect(redactObviousSecretLiterals("UPDATE users SET token='abc123', name='ok'")).toContain('token=[REDACTED]');
    expect(redactObviousSecretLiterals('{"password":"abc123"}')).toContain('"password": [REDACTED]');
  });
});
