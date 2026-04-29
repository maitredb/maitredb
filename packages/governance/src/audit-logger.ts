import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import type { GovernanceAuditEntry } from './types.js';

interface BetterSqlite3Database {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number };
    all(...params: unknown[]): Record<string, unknown>[];
  };
  close(): void;
}

interface BetterSqlite3Ctor {
  new (path: string): BetterSqlite3Database;
}

export interface AuditLoggerOptions {
  dbPath?: string;
  enabled?: boolean;
  databaseCtor?: BetterSqlite3Ctor | null;
}

export interface AuditQueryOptions {
  agentId?: string;
  connection?: string;
  blockedOnly?: boolean;
  last?: number;
}

const DEFAULT_HISTORY_PATH = join(homedir(), '.maitredb', 'history.db');
const SENSITIVE_SQL_KEY_PATTERN = 'password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|secret[_-]?key|client[_-]?secret|private[_-]?key|refresh[_-]?token';
const SQL_LITERAL_PATTERN = "'(?:''|[^'])*'|\\\"(?:[^\\\"\\\\]|\\\\.)*\\\"|[^\\s,);}\\]]+";

export class AuditLogger {
  private readonly db?: BetterSqlite3Database;

  constructor(options: AuditLoggerOptions = {}) {
    if (options.enabled === false) return;
    const dbPath = options.dbPath ?? DEFAULT_HISTORY_PATH;
    const DatabaseCtor = options.databaseCtor === undefined ? loadBetterSqlite3() : options.databaseCtor;
    if (!DatabaseCtor) return;
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseCtor(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        connection TEXT NOT NULL,
        agent_id TEXT,
        query TEXT NOT NULL,
        classification_type TEXT,
        operation TEXT,
        policy_name TEXT,
        allowed BOOLEAN,
        blocked_reason TEXT,
        error_code INTEGER,
        row_estimate INTEGER,
        execution_ms INTEGER,
        affected_rows INTEGER,
        CHECK (allowed = FALSE OR blocked_reason IS NULL)
      );
      CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_blocked ON audit_log(allowed, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_connection ON audit_log(connection, timestamp DESC);
      CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
      BEFORE DELETE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'audit_log is append-only');
      END;
      CREATE TRIGGER IF NOT EXISTS audit_log_no_update
      BEFORE UPDATE ON audit_log
      BEGIN
        SELECT RAISE(ABORT, 'audit_log is append-only');
      END;
    `);
  }

  isAvailable(): boolean {
    return !!this.db;
  }

  record(entry: GovernanceAuditEntry): void {
    if (!this.db) return;
    this.db.prepare(`
      INSERT INTO audit_log(
        id, timestamp, connection, agent_id, query, classification_type, operation,
        policy_name, allowed, blocked_reason, error_code, row_estimate, execution_ms, affected_rows
      )
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.id,
      entry.timestamp.getTime(),
      entry.connection,
      entry.agentId ?? null,
      redactObviousSecretLiterals(entry.query),
      entry.classificationType ?? null,
      entry.operation ?? null,
      entry.policyName ?? null,
      entry.allowed ? 1 : 0,
      entry.blockedReason ?? null,
      entry.errorCode ?? null,
      entry.rowEstimate ?? null,
      entry.executionMs ?? null,
      entry.affectedRows ?? null,
    );
  }

  query(options: AuditQueryOptions = {}): GovernanceAuditEntry[] {
    if (!this.db) return [];
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (options.agentId) {
      clauses.push('agent_id = ?');
      params.push(options.agentId);
    }
    if (options.connection) {
      clauses.push('connection = ?');
      params.push(options.connection);
    }
    if (options.blockedOnly) {
      clauses.push('allowed = FALSE');
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(options.last ?? 20);
    const rows = this.db.prepare(`
      SELECT id, timestamp, connection, agent_id, query, classification_type, operation,
        policy_name, allowed, blocked_reason, error_code, row_estimate, execution_ms, affected_rows
      FROM audit_log
      ${where}
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(...params);
    return rows.map((row) => ({
      id: String(row['id']),
      timestamp: new Date(Number(row['timestamp'])),
      connection: String(row['connection']),
      agentId: row['agent_id'] === null ? undefined : String(row['agent_id']),
      query: String(row['query']),
      classificationType: row['classification_type'] === null ? undefined : row['classification_type'] as GovernanceAuditEntry['classificationType'],
      operation: row['operation'] === null ? undefined : String(row['operation']),
      policyName: row['policy_name'] === null ? undefined : String(row['policy_name']),
      allowed: Boolean(row['allowed']),
      blockedReason: row['blocked_reason'] === null ? undefined : String(row['blocked_reason']),
      errorCode: row['error_code'] === null ? undefined : Number(row['error_code']) as GovernanceAuditEntry['errorCode'],
      rowEstimate: row['row_estimate'] === null ? undefined : Number(row['row_estimate']),
      executionMs: row['execution_ms'] === null ? undefined : Number(row['execution_ms']),
      affectedRows: row['affected_rows'] === null ? undefined : Number(row['affected_rows']),
    }));
  }

  close(): void {
    this.db?.close();
  }
}

export function redactObviousSecretLiterals(sql: string): string {
  const assignmentPattern = new RegExp(`\\b(${SENSITIVE_SQL_KEY_PATTERN})\\b\\s*=\\s*(${SQL_LITERAL_PATTERN})`, 'gi');
  const jsonPattern = new RegExp(`([\"'])(${SENSITIVE_SQL_KEY_PATTERN})\\1\\s*:\\s*(${SQL_LITERAL_PATTERN})`, 'gi');
  return sql
    .replace(assignmentPattern, '$1=[REDACTED]')
    .replace(jsonPattern, '$1$2$1: [REDACTED]');
}

function loadBetterSqlite3(): BetterSqlite3Ctor | undefined {
  const require = createRequire(import.meta.url);
  try {
    return require('better-sqlite3') as BetterSqlite3Ctor;
  } catch {
    return undefined;
  }
}

export function defaultAuditPathExists(): boolean {
  return existsSync(DEFAULT_HISTORY_PATH);
}
