import type { DatabaseDialect } from '@maitredb/plugin-api';
import type { MaitreErrorCode } from '@maitredb/core';

export type QueryClassificationType = 'read' | 'write' | 'ddl' | 'dcl' | 'transaction' | 'procedure' | 'unknown';

export type PolicyOperationKey =
  | 'read'
  | 'insert'
  | 'update'
  | 'delete'
  | 'truncate'
  | 'drop'
  | 'alter'
  | 'ddl'
  | 'transaction'
  | 'vacuum'
  | 'grant'
  | 'procedure'
  | 'import'
  | 'export'
  | 'explain';

export interface QueryClassification {
  dialect?: DatabaseDialect;
  type: QueryClassificationType;
  operation: string;
  policyOperation: PolicyOperationKey;
  affectedSchemas: string[];
  affectedTables: string[];
  statementCount: number;
  joinCount: number;
  subqueryDepth: number;
  hasWhereClause: boolean;
  isSensitiveOperation: boolean;
  wouldModifyTables: boolean;
  dangerousPatterns: string[];
  normalizedSql: string;
}

export interface OperationPolicy {
  allowed: boolean;
  allowIfHasWhereClause?: boolean;
}

export interface ExplainGatePolicy {
  rowEstimateThreshold?: number;
  joinCountThreshold?: number;
  subqueryDepthThreshold?: number;
}

export interface GovernancePolicy {
  mode: 'read-only' | 'read-write' | 'unrestricted';
  operations: Partial<Record<PolicyOperationKey, OperationPolicy>>;
  allowedSchemas?: string[];
  forbiddenPatterns?: string[];
  maxRowsPerQuery?: number;
  maxQueriesPerMinute?: number;
  maxConcurrentQueries?: number;
  sessionTimeoutMs?: number;
  requireExplainBefore?: ExplainGatePolicy;
  auditAllOperations?: boolean;
  requireApprovalFor?: string[];
  approvalTimeout?: number;
  blockedReasonMessage?: string;
}

export interface GovernancePolicyFile {
  policies: Record<string, GovernancePolicy>;
  connectionPolicies?: Record<string, string>;
}

export interface PolicyContext {
  connectionName: string;
  policyName?: string;
  agentId?: string;
  rowEstimate?: number;
  requestedRows?: number;
  approvalGranted?: boolean;
  now?: Date;
}

export interface PolicyDecision {
  allowed: boolean;
  policyName: string;
  blockedReason?: string;
  suggestion?: string;
  errorCode?: MaitreErrorCode;
  requiresApproval?: boolean;
  requiresExplain?: boolean;
  classification: QueryClassification;
}

export interface ApprovalRecord {
  operationId: string;
  token: string;
  queryHash: string;
  connection: string;
  policyName: string;
  agentId?: string;
  operation: string;
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}

export type AuditAllowedValue = boolean;

export interface GovernanceAuditEntry {
  id: string;
  timestamp: Date;
  connection: string;
  agentId?: string;
  query: string;
  classificationType?: QueryClassificationType;
  operation?: string;
  policyName?: string;
  allowed: AuditAllowedValue;
  blockedReason?: string;
  errorCode?: MaitreErrorCode;
  rowEstimate?: number;
  executionMs?: number;
  affectedRows?: number;
}

export interface QueryHook {
  phase: 'before' | 'after' | 'error';
  query: string;
  connectionName: string;
  policy?: GovernancePolicy;
  classification?: QueryClassification;
  decision?: PolicyDecision;
  result?: unknown;
  error?: Error;
}

export interface HookHandler {
  (hook: QueryHook): Promise<void> | void;
}
