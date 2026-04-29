import type { CommandModule } from 'yargs';
import { randomUUID } from 'node:crypto';
import { QueryExecutor, getFormatter, autoDetectFormat, MaitreError, MaitreErrorCode, exitCodeForError, recordBatchToRows } from '@maitredb/core';
import type { OutputFormat } from '@maitredb/core';
import type { ManagedConnection } from '@maitredb/core';
import {
  ApprovalManager,
  AuditLogger,
  PolicyEngine,
  QueryClassifier,
  type PolicyDecision,
  type QueryClassification,
} from '@maitredb/governance';
import { getCacheManager, getConfigManager, getConnectionManager, getHistoryStore } from '../bootstrap.js';

/** `mdb query` command — runs adhoc SQL against a saved connection. */
export const queryCommand: CommandModule = {
  command: 'query <conn> [sql]',
  describe: 'Execute a SQL query',
  builder: (yargs) =>
    yargs
      .positional('conn', { type: 'string', demandOption: true, describe: 'Connection name' })
      .positional('sql', { type: 'string', describe: 'SQL query' })
      .option('format', {
        alias: 'f',
        type: 'string',
        describe: 'Output format',
        choices: ['table', 'json', 'csv', 'ndjson', 'raw'],
      })
      .option('file', {
        type: 'string',
        describe: 'Read SQL from file',
      })
      .option('stream', {
        type: 'boolean',
        default: false,
        describe: 'Stream output with constant memory (one RecordBatch at a time)',
      })
      .option('batch-size', {
        type: 'number',
        default: 10_000,
        describe: 'Rows per Arrow batch in streaming mode',
      })
      .option('as', {
        type: 'string',
        choices: ['human', 'agent'],
        describe: 'Execution identity; --as agent enables governance policy enforcement',
      })
      .option('policy', {
        type: 'string',
        describe: 'Governance policy name to apply in agent mode',
      })
      .option('agent-id', {
        type: 'string',
        describe: 'Agent identifier written to the audit log',
      })
      .option('dry-run', {
        type: 'boolean',
        default: false,
        describe: 'Classify and prepare an operation without executing it',
      })
      .option('approval-token', {
        type: 'string',
        describe: 'Human approval token for an operation prepared with --dry-run',
      })
      .check((argv) => {
        if (!argv.sql && !argv.file) {
          throw new Error('Provide a SQL query or --file');
        }
        return true;
      }),
  handler: async (argv) => {
    let conn: ManagedConnection | undefined;
    const connMgr = getConnectionManager();
    try {
      const connName = argv.conn as string;
      const configMgr = getConfigManager();
      conn = await connMgr.getConnection(connName);

      let sql = argv.sql as string | undefined;
      const file = argv.file as string | undefined;
      if (file) {
        const { readFileSync } = await import('node:fs');
        sql = readFileSync(file, 'utf-8');
      }

      const config = configMgr.getConfig();
      const governance = prepareGovernance(argv, connName, sql!, conn);
      if (governance) {
        if (governance.dryRun) {
          const policy = governance.policyEngine.getPolicy(governance.decision.policyName);
          const approval = governance.decision.requiresApproval
            ? governance.approvalManager.prepare({
                query: sql!,
                connection: connName,
                policyName: governance.decision.policyName,
                agentId: governance.agentId,
                classification: governance.classification,
                ttlMs: policy.approvalTimeout ?? 3600000,
              })
            : undefined;

          governance.auditLogger.record({
            id: approval?.operationId ?? randomUUID(),
            timestamp: new Date(),
            connection: connName,
            agentId: governance.agentId,
            query: sql!,
            classificationType: governance.classification.type,
            operation: governance.classification.operation,
            policyName: governance.decision.policyName,
            allowed: false,
            blockedReason: governance.decision.blockedReason ?? 'Dry run only',
            errorCode: governance.decision.errorCode,
          });

          console.log(JSON.stringify({
            operationId: approval?.operationId,
            operation: governance.classification.operation,
            query: sql!,
            classification: governance.classification,
            policy: governance.decision.policyName,
            allowed: governance.decision.allowed,
            requiresApproval: governance.decision.requiresApproval ?? false,
            blockedReason: governance.decision.blockedReason,
            approvalToken: approval?.token,
            approvalExpiresAt: approval?.expiresAt,
          }, null, 2));
          return;
        }

        if (!governance.decision.allowed) {
          governance.auditLogger.record({
            id: randomUUID(),
            timestamp: new Date(),
            connection: connName,
            agentId: governance.agentId,
            query: sql!,
            classificationType: governance.classification.type,
            operation: governance.classification.operation,
            policyName: governance.decision.policyName,
            allowed: false,
            blockedReason: governance.decision.blockedReason,
            errorCode: governance.decision.errorCode,
          });
          throw decisionToError(governance.decision, conn.dialect);
        }
      }

      const executor = new QueryExecutor(conn.adapter, {
        maxBufferedRows: config.maxRows,
        cache: getCacheManager(),
        history: getHistoryStore(),
        connectionId: connName,
        connectionName: connName,
        caller: governance ? 'agent' : 'human',
        logParamsForProduction: config.history?.logParamsForProduction,
      });
      const format = (argv.format as OutputFormat) ?? autoDetectFormat();
      const streaming = argv.stream as boolean;
      const batchSize = argv['batch-size'] as number;

      if (streaming) {
        governance?.policyEngine.beginQuery();
        let streamedRows = 0;
        const start = performance.now();
        let effectiveFormat = format;
        if (effectiveFormat === 'table') {
          process.stderr.write('[maitredb] --stream: table format requires all rows; using ndjson\n');
          effectiveFormat = 'ndjson';
        }
        const formatter = getFormatter(effectiveFormat);
        for await (const batch of executor.stream(conn, sql!, [], { batchSize })) {
          const rows = recordBatchToRows(batch);
          streamedRows += rows.length;
          if (rows.length === 0) continue;
          const batchResult = { rows, fields: [], rowCount: rows.length, durationMs: 0 };
          process.stdout.write(formatter.format(batchResult) + '\n');
        }
        if (governance) {
          governance.policyEngine.endQuery();
          governance.auditLogger.record({
            id: randomUUID(),
            timestamp: new Date(),
            connection: connName,
            agentId: governance.agentId,
            query: sql!,
            classificationType: governance.classification.type,
            operation: governance.classification.operation,
            policyName: governance.decision.policyName,
            allowed: true,
            executionMs: Math.round(performance.now() - start),
            affectedRows: streamedRows,
          });
        }
      } else {
        governance?.policyEngine.beginQuery();
        const result = await executor.execute(conn, sql!);
        if (governance) {
          governance.policyEngine.endQuery();
          governance.auditLogger.record({
            id: randomUUID(),
            timestamp: new Date(),
            connection: connName,
            agentId: governance.agentId,
            query: sql!,
            classificationType: governance.classification.type,
            operation: governance.classification.operation,
            policyName: governance.decision.policyName,
            allowed: true,
            executionMs: Math.round(result.durationMs),
            affectedRows: result.rowCount,
          });
        }
        const formatter = getFormatter(format);
        console.log(formatter.format(result));
      }
    } catch (err) {
      if (err instanceof MaitreError) {
        process.stderr.write(JSON.stringify(err.toJSON()) + '\n');
        process.exit(exitCodeForError(err));
      }
      process.stderr.write(JSON.stringify({ error: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : String(err) }) + '\n');
      process.exit(3);
    } finally {
      if (conn) {
        await connMgr.releaseConnection(conn);
      }
      await connMgr.closeAll();
      getCacheManager().close();
      getHistoryStore().close();
    }
  },
};

interface CliGovernanceContext {
  agentId: string;
  dryRun: boolean;
  classification: QueryClassification;
  decision: PolicyDecision;
  policyEngine: PolicyEngine;
  approvalManager: ApprovalManager;
  auditLogger: AuditLogger;
}

function prepareGovernance(
  argv: Record<string, unknown>,
  connectionName: string,
  sql: string,
  conn: ManagedConnection,
): CliGovernanceContext | undefined {
  if (argv['as'] !== 'agent') return undefined;

  const classifier = new QueryClassifier();
  const policyEngine = PolicyEngine.load();
  const approvalManager = new ApprovalManager();
  const auditLogger = new AuditLogger();
  const agentId = (argv['agent-id'] as string | undefined) ?? process.env['MDB_AGENT_ID'] ?? 'agent-cli';
  const policyName = policyEngine.resolvePolicyName(connectionName, argv['policy'] as string | undefined);
  const classification = classifier.classify(sql, conn.dialect);
  const approvalToken = argv['approval-token'] as string | undefined;
  let approvalGranted = false;

  if (approvalToken) {
    approvalManager.validateAndConsume({
      token: approvalToken,
      query: sql,
      connection: connectionName,
      policyName,
      agentId,
      operation: classification.operation,
    });
    approvalGranted = true;
  }

  const decision = policyEngine.evaluate(classification, {
    connectionName,
    policyName,
    agentId,
    approvalGranted,
  });

  return {
    agentId,
    dryRun: argv['dry-run'] === true,
    classification,
    decision,
    policyEngine,
    approvalManager,
    auditLogger,
  };
}

function decisionToError(decision: PolicyDecision, dialect: ManagedConnection['dialect']): MaitreError {
  return new MaitreError(
    decision.errorCode ?? MaitreErrorCode.POLICY_VIOLATION,
    decision.blockedReason ?? 'Query blocked by governance policy',
    dialect,
    undefined,
    decision.suggestion,
  );
}
