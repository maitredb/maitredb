import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';
import type {
  GovernancePolicy,
  GovernancePolicyFile,
  PolicyContext,
  PolicyDecision,
  PolicyOperationKey,
  QueryClassification,
} from './types.js';

export const DEFAULT_POLICY_NAME = 'agent-default';
export const DEFAULT_POLICIES_PATH = join(homedir(), '.maitredb', 'policies.json');

export const DEFAULT_AGENT_POLICY: GovernancePolicy = {
  mode: 'read-only',
  operations: {
    read: { allowed: true },
    explain: { allowed: true },
    insert: { allowed: false },
    update: { allowed: false },
    delete: { allowed: false, allowIfHasWhereClause: false },
    truncate: { allowed: false },
    drop: { allowed: false },
    alter: { allowed: false },
    ddl: { allowed: false },
    transaction: { allowed: true },
    vacuum: { allowed: false },
    grant: { allowed: false },
    procedure: { allowed: false },
    import: { allowed: false },
    export: { allowed: false },
  },
  allowedSchemas: ['public', 'main'],
  forbiddenPatterns: ['^admin_.*', '^system_.*', '.*_secret$', '.*_private$'],
  maxRowsPerQuery: 10000,
  maxQueriesPerMinute: 60,
  maxConcurrentQueries: 5,
  sessionTimeoutMs: 300000,
  requireExplainBefore: {
    rowEstimateThreshold: 1000000,
    joinCountThreshold: 5,
    subqueryDepthThreshold: 3,
  },
  auditAllOperations: true,
  requireApprovalFor: ['UPDATE', 'DELETE'],
  approvalTimeout: 3600000,
  blockedReasonMessage: 'Destructive operations are not allowed for agents.',
};

export class PolicyEngine {
  private readonly policyFile: GovernancePolicyFile;
  private readonly queryTimestampsByAgent = new Map<string, number[]>();
  private activeQueries = 0;

  constructor(policyFile: GovernancePolicyFile = defaultPolicyFile()) {
    validatePolicyFile(policyFile);
    this.policyFile = policyFile;
  }

  static load(path = DEFAULT_POLICIES_PATH): PolicyEngine {
    return new PolicyEngine(loadPolicyFile(path));
  }

  getPolicy(name: string): GovernancePolicy {
    const policy = this.policyFile.policies[name];
    if (!policy) {
      throw new MaitreError(
        MaitreErrorCode.POLICY_VIOLATION,
        `Governance policy "${name}" was not found`,
        undefined,
        undefined,
        'Use --policy with a configured policy name or add it to policies.json.',
      );
    }
    return policy;
  }

  resolvePolicyName(connectionName: string, requestedPolicyName?: string): string {
    return requestedPolicyName
      ?? this.policyFile.connectionPolicies?.[connectionName]
      ?? DEFAULT_POLICY_NAME;
  }

  evaluate(classification: QueryClassification, context: PolicyContext): PolicyDecision {
    const policyName = this.resolvePolicyName(context.connectionName, context.policyName);
    const policy = this.getPolicy(policyName);
    const now = context.now?.getTime() ?? Date.now();

    const rateDecision = this.evaluateRateLimit(policy, context.agentId ?? 'agent', now, classification, policyName);
    if (rateDecision) return rateDecision;

    const concurrencyDecision = this.evaluateConcurrency(policy, classification, policyName);
    if (concurrencyDecision) return concurrencyDecision;

    const schemaDecision = this.evaluateSchemaRules(policy, classification, policyName);
    if (schemaDecision) return schemaDecision;

    const complexityDecision = this.evaluateComplexity(policy, classification, policyName, context.rowEstimate);
    if (complexityDecision) return complexityDecision;

    const resultSizeDecision = this.evaluateResultSize(policy, classification, policyName, context.requestedRows);
    if (resultSizeDecision) return resultSizeDecision;

    const approvalDecision = this.evaluateApprovalRequirement(policy, classification, policyName, context.approvalGranted === true);
    if (approvalDecision) return approvalDecision;

    const operationDecision = this.evaluateOperationPolicy(policy, classification, policyName, context.approvalGranted === true);
    if (operationDecision) return operationDecision;

    return { allowed: true, policyName, classification };
  }

  beginQuery(): void {
    this.activeQueries += 1;
  }

  endQuery(): void {
    this.activeQueries = Math.max(0, this.activeQueries - 1);
  }

  private evaluateRateLimit(
    policy: GovernancePolicy,
    agentId: string,
    now: number,
    classification: QueryClassification,
    policyName: string,
  ): PolicyDecision | undefined {
    if (!policy.maxQueriesPerMinute) return undefined;
    const windowStart = now - 60000;
    const timestamps = (this.queryTimestampsByAgent.get(agentId) ?? []).filter((timestamp) => timestamp >= windowStart);
    if (timestamps.length >= policy.maxQueriesPerMinute) {
      return blockedDecision(
        classification,
        policyName,
        MaitreErrorCode.RATE_LIMITED,
        `Rate limit exceeded: max ${policy.maxQueriesPerMinute} queries per minute`,
        'Wait before issuing another query or use a less restrictive policy.',
      );
    }
    timestamps.push(now);
    this.queryTimestampsByAgent.set(agentId, timestamps);
    return undefined;
  }

  private evaluateConcurrency(
    policy: GovernancePolicy,
    classification: QueryClassification,
    policyName: string,
  ): PolicyDecision | undefined {
    if (policy.maxConcurrentQueries && this.activeQueries >= policy.maxConcurrentQueries) {
      return blockedDecision(
        classification,
        policyName,
        MaitreErrorCode.RATE_LIMITED,
        `Concurrent query limit exceeded: max ${policy.maxConcurrentQueries}`,
        'Wait for an in-flight query to finish or use a policy with a higher concurrent limit.',
      );
    }
    return undefined;
  }

  private evaluateSchemaRules(
    policy: GovernancePolicy,
    classification: QueryClassification,
    policyName: string,
  ): PolicyDecision | undefined {
    const allowedSchemas = new Set((policy.allowedSchemas ?? []).map((schema) => schema.toLowerCase()));
    if (allowedSchemas.size > 0) {
      for (const schema of classification.affectedSchemas) {
        if (!allowedSchemas.has(schema.toLowerCase())) {
          return blockedDecision(
            classification,
            policyName,
            MaitreErrorCode.SCHEMA_NOT_ALLOWED,
            `Schema "${schema}" is not allowed by policy`,
            'Use an allowed schema or ask a human to update the governance policy.',
          );
        }
      }
    }

    for (const pattern of policy.forbiddenPatterns ?? []) {
      const regex = new RegExp(pattern, 'i');
      const blockedTable = classification.affectedTables.find((table) => regex.test(table.split('.').at(-1) ?? table));
      if (blockedTable) {
        return blockedDecision(
          classification,
          policyName,
          MaitreErrorCode.OPERATION_BLOCKED,
          `Table "${blockedTable}" matches forbidden pattern ${pattern}`,
          'Choose a non-sensitive table or request human approval outside agent mode.',
        );
      }
    }
    return undefined;
  }

  private evaluateComplexity(
    policy: GovernancePolicy,
    classification: QueryClassification,
    policyName: string,
    rowEstimate?: number,
  ): PolicyDecision | undefined {
    const gate = policy.requireExplainBefore;
    if (!gate) return undefined;
    if (gate.joinCountThreshold !== undefined && classification.joinCount > gate.joinCountThreshold) {
      return explainDecision(classification, policyName, `Query has ${classification.joinCount} joins; threshold is ${gate.joinCountThreshold}`);
    }
    if (gate.subqueryDepthThreshold !== undefined && classification.subqueryDepth > gate.subqueryDepthThreshold) {
      return explainDecision(classification, policyName, `Query subquery depth is ${classification.subqueryDepth}; threshold is ${gate.subqueryDepthThreshold}`);
    }
    if (rowEstimate !== undefined && gate.rowEstimateThreshold !== undefined && rowEstimate > gate.rowEstimateThreshold) {
      return explainDecision(classification, policyName, `Estimated ${rowEstimate} rows; threshold is ${gate.rowEstimateThreshold}`);
    }
    return undefined;
  }

  private evaluateResultSize(
    policy: GovernancePolicy,
    classification: QueryClassification,
    policyName: string,
    requestedRows?: number,
  ): PolicyDecision | undefined {
    if (policy.maxRowsPerQuery === undefined || requestedRows === undefined || requestedRows <= policy.maxRowsPerQuery) {
      return undefined;
    }
    return blockedDecision(
      classification,
      policyName,
      MaitreErrorCode.POLICY_VIOLATION,
      `Requested row limit ${requestedRows} exceeds policy maxRowsPerQuery ${policy.maxRowsPerQuery}`,
      'Lower the requested row limit or stream results under human supervision.',
    );
  }

  private evaluateApprovalRequirement(
    policy: GovernancePolicy,
    classification: QueryClassification,
    policyName: string,
    approvalGranted: boolean,
  ): PolicyDecision | undefined {
    const requiresApproval = (policy.requireApprovalFor ?? [])
      .map((operation) => operation.toUpperCase())
      .includes(classification.operation.toUpperCase());
    if (!requiresApproval) return undefined;
    if (approvalGranted) return undefined;
    return {
      allowed: false,
      policyName,
      classification,
      requiresApproval: true,
      blockedReason: `${classification.operation} operations require human approval`,
      suggestion: 'Run with --dry-run to prepare an approval token, then retry with --approval-token.',
      errorCode: MaitreErrorCode.APPROVAL_REQUIRED,
    };
  }

  private evaluateOperationPolicy(
    policy: GovernancePolicy,
    classification: QueryClassification,
    policyName: string,
    approvalGranted: boolean,
  ): PolicyDecision | undefined {
    if (policy.mode === 'unrestricted') return undefined;

    const approvalCanOverride = approvalGranted
      && (policy.requireApprovalFor ?? []).map((operation) => operation.toUpperCase()).includes(classification.operation.toUpperCase());
    if (approvalCanOverride && !classification.dangerousPatterns.includes('delete_without_where')) return undefined;

    const operationPolicy = policy.operations[classification.policyOperation] ?? defaultOperationPolicy(classification.policyOperation, policy.mode);
    if (operationPolicy.allowed) {
      if (classification.policyOperation === 'delete' && operationPolicy.allowIfHasWhereClause === true && !classification.hasWhereClause) {
        return blockedDecision(
          classification,
          policyName,
          MaitreErrorCode.OPERATION_BLOCKED,
          'DELETE without WHERE is not allowed by policy',
          'Add a WHERE clause or ask a human to perform the operation.',
        );
      }
      return undefined;
    }

    return blockedDecision(
      classification,
      policyName,
      MaitreErrorCode.OPERATION_BLOCKED,
      policy.blockedReasonMessage ?? `${classification.operation} operations are not allowed for agents`,
      'If this destructive operation is intentional, connect without --as agent as a human operator.',
    );
  }
}

export function loadPolicyFile(path = DEFAULT_POLICIES_PATH): GovernancePolicyFile {
  if (!existsSync(path)) return defaultPolicyFile();
  const parsed = JSON.parse(readFileSync(path, 'utf-8')) as GovernancePolicyFile;
  return mergeWithDefaults(parsed);
}

export function defaultPolicyFile(): GovernancePolicyFile {
  return {
    policies: {
      [DEFAULT_POLICY_NAME]: clonePolicy(DEFAULT_AGENT_POLICY),
      'human-default': {
        mode: 'unrestricted',
        operations: {},
        auditAllOperations: true,
      },
    },
    connectionPolicies: {},
  };
}

export function validatePolicyFile(policyFile: GovernancePolicyFile): void {
  if (!policyFile.policies || typeof policyFile.policies !== 'object') {
    throw new MaitreError(MaitreErrorCode.POLICY_VIOLATION, 'policies.json must contain a policies object');
  }
  for (const [connectionName, policyName] of Object.entries(policyFile.connectionPolicies ?? {})) {
    if (!policyFile.policies[policyName]) {
      throw new MaitreError(
        MaitreErrorCode.POLICY_VIOLATION,
        `Connection policy for "${connectionName}" references missing policy "${policyName}"`,
      );
    }
  }
  for (const [policyName, policy] of Object.entries(policyFile.policies)) {
    if (!['read-only', 'read-write', 'unrestricted'].includes(policy.mode)) {
      throw new MaitreError(MaitreErrorCode.POLICY_VIOLATION, `Policy "${policyName}" has invalid mode`);
    }
    for (const pattern of policy.forbiddenPatterns ?? []) {
      try {
        new RegExp(pattern);
      } catch {
        throw new MaitreError(MaitreErrorCode.POLICY_VIOLATION, `Policy "${policyName}" has invalid forbidden pattern: ${pattern}`);
      }
    }
    for (const [fieldName, value] of Object.entries({
      maxRowsPerQuery: policy.maxRowsPerQuery,
      maxQueriesPerMinute: policy.maxQueriesPerMinute,
      maxConcurrentQueries: policy.maxConcurrentQueries,
      sessionTimeoutMs: policy.sessionTimeoutMs,
      approvalTimeout: policy.approvalTimeout,
    })) {
      if (value !== undefined && value <= 0) {
        throw new MaitreError(MaitreErrorCode.POLICY_VIOLATION, `Policy "${policyName}" requires ${fieldName} to be positive`);
      }
    }
  }
}

function mergeWithDefaults(policyFile: GovernancePolicyFile): GovernancePolicyFile {
  return {
    policies: {
      ...defaultPolicyFile().policies,
      ...policyFile.policies,
    },
    connectionPolicies: policyFile.connectionPolicies ?? {},
  };
}

function defaultOperationPolicy(operation: PolicyOperationKey, mode: GovernancePolicy['mode']): NonNullable<GovernancePolicy['operations'][PolicyOperationKey]> {
  if (mode === 'read-write') {
    return { allowed: ['read', 'explain', 'insert', 'transaction'].includes(operation) };
  }
  return { allowed: ['read', 'explain', 'transaction'].includes(operation) };
}

function blockedDecision(
  classification: QueryClassification,
  policyName: string,
  errorCode: MaitreErrorCode,
  blockedReason: string,
  suggestion: string,
): PolicyDecision {
  return { allowed: false, policyName, classification, blockedReason, suggestion, errorCode };
}

function explainDecision(classification: QueryClassification, policyName: string, blockedReason: string): PolicyDecision {
  return {
    allowed: false,
    policyName,
    classification,
    requiresExplain: true,
    blockedReason,
    suggestion: 'Run EXPLAIN or narrow the query before executing it as an agent.',
    errorCode: MaitreErrorCode.EXPLAIN_REQUIRED,
  };
}

function clonePolicy(policy: GovernancePolicy): GovernancePolicy {
  return JSON.parse(JSON.stringify(policy)) as GovernancePolicy;
}
