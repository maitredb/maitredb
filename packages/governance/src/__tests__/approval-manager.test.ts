import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MaitreErrorCode } from '@maitredb/core';
import { ApprovalManager } from '../approval-manager.js';
import { QueryClassifier } from '../classifier.js';

function approvalPath(): string {
  return join(tmpdir(), `mdb-approvals-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
}

function captureError(action: () => void): unknown {
  try {
    action();
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('ApprovalManager', () => {
  const createdPaths: string[] = [];

  afterEach(() => {
    for (const path of createdPaths.splice(0)) {
      if (existsSync(path)) rmSync(path, { force: true });
    }
  });

  it('generates, validates, and consumes one-time approval tokens', () => {
    const path = approvalPath();
    createdPaths.push(path);
    let now = 1000;
    const manager = new ApprovalManager({ path, now: () => now });
    const classification = new QueryClassifier().classify('UPDATE users SET status = 1 WHERE id = 2', 'sqlite');

    const approval = manager.prepare({
      query: 'UPDATE users SET status = 1 WHERE id = 2',
      connection: 'prod',
      policyName: 'agent-default',
      agentId: 'agent-a',
      classification,
      ttlMs: 1000,
    });

    expect(approval.token).toMatch(/^token-/);
    const consumed = manager.validateAndConsume({
      token: approval.token,
      query: 'UPDATE users SET status = 1 WHERE id = 2',
      connection: 'prod',
      policyName: 'agent-default',
      agentId: 'agent-a',
      operation: 'UPDATE',
    });
    expect(consumed.usedAt).toBe(1000);
    expect(captureError(() => manager.validateAndConsume({
      token: approval.token,
      query: 'UPDATE users SET status = 1 WHERE id = 2',
      connection: 'prod',
      policyName: 'agent-default',
      agentId: 'agent-a',
      operation: 'UPDATE',
    }))).toMatchObject({ code: MaitreErrorCode.APPROVAL_EXPIRED });

    now = 3000;
    const expired = manager.prepare({
      query: 'UPDATE users SET status = 2 WHERE id = 2',
      connection: 'prod',
      policyName: 'agent-default',
      agentId: 'agent-a',
      classification,
      ttlMs: 1,
    });
    now = 4000;
    expect(captureError(() => manager.validateAndConsume({
      token: expired.token,
      query: 'UPDATE users SET status = 2 WHERE id = 2',
      connection: 'prod',
      policyName: 'agent-default',
      agentId: 'agent-a',
      operation: 'UPDATE',
    }))).toMatchObject({ code: MaitreErrorCode.APPROVAL_EXPIRED });
  });

  it('rejects tokens for a different query or connection', () => {
    const path = approvalPath();
    createdPaths.push(path);
    const manager = new ApprovalManager({ path, now: () => 1000 });
    const classification = new QueryClassifier().classify('UPDATE users SET status = 1 WHERE id = 2', 'sqlite');
    const approval = manager.prepare({
      query: 'UPDATE users SET status = 1 WHERE id = 2',
      connection: 'prod',
      policyName: 'agent-default',
      classification,
      ttlMs: 1000,
    });

    expect(captureError(() => manager.validateAndConsume({
      token: approval.token,
      query: 'UPDATE users SET status = 9 WHERE id = 2',
      connection: 'prod',
      policyName: 'agent-default',
      operation: 'UPDATE',
    }))).toMatchObject({ code: MaitreErrorCode.POLICY_VIOLATION });
  });
});
