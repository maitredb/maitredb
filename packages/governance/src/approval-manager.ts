import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';
import type { ApprovalRecord, QueryClassification } from './types.js';

export interface ApprovalManagerOptions {
  path?: string;
  now?: () => number;
}

const DEFAULT_APPROVAL_PATH = join(homedir(), '.maitredb', 'approvals.json');

export class ApprovalManager {
  private readonly path: string;
  private readonly now: () => number;

  constructor(options: ApprovalManagerOptions = {}) {
    this.path = options.path ?? DEFAULT_APPROVAL_PATH;
    this.now = options.now ?? Date.now;
  }

  prepare(input: {
    query: string;
    connection: string;
    policyName: string;
    agentId?: string;
    classification: QueryClassification;
    ttlMs: number;
  }): ApprovalRecord {
    const records = this.readRecords().filter((record) => !isExpired(record, this.now()));
    const record: ApprovalRecord = {
      operationId: `op-${randomUUID()}`,
      token: `token-${randomBytes(18).toString('base64url')}`,
      queryHash: hashQuery(input.query),
      connection: input.connection,
      policyName: input.policyName,
      agentId: input.agentId,
      operation: input.classification.operation,
      createdAt: this.now(),
      expiresAt: this.now() + input.ttlMs,
    };
    records.push(record);
    this.writeRecords(records);
    return record;
  }

  validateAndConsume(input: {
    token: string;
    query: string;
    connection: string;
    policyName: string;
    agentId?: string;
    operation: string;
  }): ApprovalRecord {
    const records = this.readRecords();
    const record = records.find((candidate) => candidate.token === input.token);
    if (!record) {
      throw new MaitreError(
        MaitreErrorCode.APPROVAL_EXPIRED,
        'Approval token was not found or has expired',
        undefined,
        undefined,
        'Run the query with --dry-run to request a fresh approval token.',
      );
    }
    if (record.usedAt !== undefined) {
      throw new MaitreError(
        MaitreErrorCode.APPROVAL_EXPIRED,
        'Approval token has already been used',
        undefined,
        undefined,
        'Approval tokens are one-time use. Request a fresh token with --dry-run.',
      );
    }
    if (isExpired(record, this.now())) {
      throw new MaitreError(
        MaitreErrorCode.APPROVAL_EXPIRED,
        'Approval token has expired',
        undefined,
        undefined,
        'Run the query with --dry-run to request a fresh approval token.',
      );
    }
    if (
      record.queryHash !== hashQuery(input.query)
      || record.connection !== input.connection
      || record.policyName !== input.policyName
      || record.operation !== input.operation
      || (record.agentId ?? undefined) !== (input.agentId ?? undefined)
    ) {
      throw new MaitreError(
        MaitreErrorCode.POLICY_VIOLATION,
        'Approval token does not match this operation',
        undefined,
        undefined,
        'Use the approval token generated for this exact query, connection, policy, and agent.',
      );
    }

    record.usedAt = this.now();
    this.writeRecords(records);
    return record;
  }

  list(): ApprovalRecord[] {
    return this.readRecords();
  }

  private readRecords(): ApprovalRecord[] {
    if (!existsSync(this.path)) return [];
    try {
      return JSON.parse(readFileSync(this.path, 'utf-8')) as ApprovalRecord[];
    } catch {
      return [];
    }
  }

  private writeRecords(records: ApprovalRecord[]): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  }
}

export function hashQuery(query: string): string {
  return createHash('sha256').update(query.trim().replace(/\s+/g, ' ')).digest('hex');
}

function isExpired(record: ApprovalRecord, now: number): boolean {
  return record.expiresAt <= now;
}
