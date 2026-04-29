import { describe, expect, it } from 'vitest';
import { MaitreErrorCode } from '@maitredb/core';
import { QueryClassifier } from '../classifier.js';
import { PolicyEngine, defaultPolicyFile } from '../policy-engine.js';

const classifier = new QueryClassifier();

describe('PolicyEngine', () => {
  it('allows read-only SELECT queries under the default agent policy', () => {
    const engine = new PolicyEngine(defaultPolicyFile());
    const classification = classifier.classify('SELECT * FROM public.users', 'postgresql');

    const decision = engine.evaluate(classification, { connectionName: 'prod', agentId: 'agent-a' });

    expect(decision.allowed).toBe(true);
    expect(decision.policyName).toBe('agent-default');
  });

  it('blocks DROP DATABASE with operation-blocked error details', () => {
    const engine = new PolicyEngine(defaultPolicyFile());
    const classification = classifier.classify('DROP DATABASE production', 'postgresql');

    const decision = engine.evaluate(classification, { connectionName: 'prod', agentId: 'agent-a' });

    expect(decision.allowed).toBe(false);
    expect(decision.errorCode).toBe(MaitreErrorCode.OPERATION_BLOCKED);
    expect(decision.blockedReason).toContain('Destructive operations');
  });

  it('requires approval for DELETE with a WHERE clause and allows it after approval', () => {
    const engine = new PolicyEngine(defaultPolicyFile());
    const classification = classifier.classify('DELETE FROM public.users WHERE id = 42', 'postgresql');

    const withoutApproval = engine.evaluate(classification, { connectionName: 'prod', agentId: 'agent-a' });
    const withApproval = engine.evaluate(classification, { connectionName: 'prod', agentId: 'agent-a', approvalGranted: true });

    expect(withoutApproval.allowed).toBe(false);
    expect(withoutApproval.errorCode).toBe(MaitreErrorCode.APPROVAL_REQUIRED);
    expect(withApproval.allowed).toBe(true);
  });

  it('keeps DELETE without WHERE blocked even with approval', () => {
    const engine = new PolicyEngine(defaultPolicyFile());
    const classification = classifier.classify('DELETE FROM public.users', 'postgresql');

    const decision = engine.evaluate(classification, { connectionName: 'prod', agentId: 'agent-a', approvalGranted: true });

    expect(decision.allowed).toBe(false);
    expect(decision.errorCode).toBe(MaitreErrorCode.OPERATION_BLOCKED);
  });

  it('enforces schema allowlists and forbidden table patterns', () => {
    const engine = new PolicyEngine(defaultPolicyFile());

    const schemaDecision = engine.evaluate(
      classifier.classify('SELECT * FROM finance.invoices', 'postgresql'),
      { connectionName: 'prod', agentId: 'agent-a' },
    );
    const tableDecision = engine.evaluate(
      classifier.classify('SELECT * FROM public.user_secret', 'postgresql'),
      { connectionName: 'prod', agentId: 'agent-a' },
    );

    expect(schemaDecision.errorCode).toBe(MaitreErrorCode.SCHEMA_NOT_ALLOWED);
    expect(tableDecision.errorCode).toBe(MaitreErrorCode.OPERATION_BLOCKED);
  });

  it('enforces rate limits and query complexity explain gates', () => {
    const policyFile = defaultPolicyFile();
    policyFile.policies['agent-default'] = {
      ...policyFile.policies['agent-default']!,
      maxQueriesPerMinute: 1,
      requireExplainBefore: { joinCountThreshold: 1 },
    };
    const engine = new PolicyEngine(policyFile);

    const simpleRead = classifier.classify('SELECT * FROM public.users', 'postgresql');
    expect(engine.evaluate(simpleRead, { connectionName: 'prod', agentId: 'agent-a', now: new Date(1) }).allowed).toBe(true);
    expect(engine.evaluate(simpleRead, { connectionName: 'prod', agentId: 'agent-a', now: new Date(2) }).errorCode).toBe(MaitreErrorCode.RATE_LIMITED);

    const complexRead = classifier.classify('SELECT * FROM public.a JOIN public.b ON a.id=b.id JOIN public.c ON c.id=b.id', 'postgresql');
    expect(engine.evaluate(complexRead, { connectionName: 'prod', agentId: 'agent-b' }).errorCode).toBe(MaitreErrorCode.EXPLAIN_REQUIRED);
  });
});
