export { QueryClassifier, stripCommentsAndLiterals, splitTopLevelStatements } from './classifier.js';
export {
  DEFAULT_AGENT_POLICY,
  DEFAULT_POLICY_NAME,
  DEFAULT_POLICIES_PATH,
  PolicyEngine,
  defaultPolicyFile,
  loadPolicyFile,
  validatePolicyFile,
} from './policy-engine.js';
export { ApprovalManager, hashQuery } from './approval-manager.js';
export { AuditLogger, redactObviousSecretLiterals } from './audit-logger.js';
export { HookRegistry } from './hooks.js';
export type {
  ApprovalRecord,
  AuditAllowedValue,
  ExplainGatePolicy,
  GovernanceAuditEntry,
  GovernancePolicy,
  GovernancePolicyFile,
  HookHandler,
  OperationPolicy,
  PolicyContext,
  PolicyDecision,
  PolicyOperationKey,
  QueryClassification,
  QueryClassificationType,
  QueryHook,
} from './types.js';
