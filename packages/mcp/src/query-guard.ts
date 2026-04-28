const WRITE_PATTERN = /^\s*(INSERT|UPDATE|DELETE|MERGE|REPLACE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|COPY|VACUUM|ANALYZE|ATTACH|DETACH|BEGIN|COMMIT|ROLLBACK)\b/i;

/**
 * Conservative SQL safety gate for MCP mode.
 * MCP server is agent-facing and read-only by default.
 */
export function isPotentiallyMutatingQuery(sql: string): boolean {
  const normalized = stripSqlComments(sql).trim();
  if (normalized.length === 0) return false;
  if (WRITE_PATTERN.test(normalized)) return true;

  // Block obvious multi-statement payloads in MCP mode.
  if (normalized.includes(';')) return true;

  return false;
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ');
}
