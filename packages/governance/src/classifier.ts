import type { DatabaseDialect } from '@maitredb/plugin-api';
import type { PolicyOperationKey, QueryClassification, QueryClassificationType } from './types.js';

const READ_OPERATIONS = new Set(['SELECT', 'WITH', 'EXPLAIN', 'SHOW', 'DESCRIBE', 'PRAGMA']);
const WRITE_OPERATIONS = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'REPLACE', 'UPSERT']);
const DDL_OPERATIONS = new Set(['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME']);
const DCL_OPERATIONS = new Set(['GRANT', 'REVOKE']);
const TRANSACTION_OPERATIONS = new Set(['BEGIN', 'START', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE']);
const PROCEDURE_OPERATIONS = new Set(['CALL', 'EXEC', 'EXECUTE']);

export class QueryClassifier {
  classify(sql: string, dialect?: DatabaseDialect): QueryClassification {
    const normalizedSql = sql.trim();
    const scrubbedSql = stripCommentsAndLiterals(normalizedSql);
    const statements = splitTopLevelStatements(scrubbedSql);
    const firstStatement = statements[0] ?? '';
    const operation = detectOperation(firstStatement);
    const type = classifyType(operation);
    const policyOperation = policyOperationFor(operation, type, firstStatement);
    const affectedTables = extractAffectedTables(firstStatement, operation);
    const affectedSchemas = extractSchemas(affectedTables);
    const dangerousPatterns = detectDangerousPatterns(firstStatement, operation, statements.length);
    const hasWhereClause = /\bWHERE\b/i.test(firstStatement);
    const wouldModifyTables = type === 'write' || type === 'ddl' || policyOperation === 'import';

    return {
      dialect,
      type,
      operation,
      policyOperation,
      affectedSchemas,
      affectedTables,
      statementCount: statements.length,
      joinCount: countMatches(firstStatement, /\bJOIN\b/gi),
      subqueryDepth: estimateSubqueryDepth(firstStatement),
      hasWhereClause,
      isSensitiveOperation: isSensitiveOperation(policyOperation, operation, dangerousPatterns),
      wouldModifyTables,
      dangerousPatterns,
      normalizedSql,
    };
  }
}

export function stripCommentsAndLiterals(sql: string): string {
  let output = '';
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (char === '-' && nextChar === '-') {
      while (index < sql.length && sql[index] !== '\n') {
        output += ' ';
        index += 1;
      }
      continue;
    }

    if (char === '/' && nextChar === '*') {
      output += '  ';
      index += 2;
      while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) {
        output += sql[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      if (index < sql.length) {
        output += '  ';
        index += 2;
      }
      continue;
    }

    if (char === "'") {
      output += ' ';
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "'" && sql[index + 1] === "'") {
          output += '  ';
          index += 2;
          continue;
        }
        const literalChar = sql[index];
        output += literalChar === '\n' ? '\n' : ' ';
        index += 1;
        if (literalChar === "'") break;
      }
      continue;
    }

    if (char === '"') {
      output += ' ';
      index += 1;
      while (index < sql.length) {
        if (sql[index] === '"' && sql[index + 1] === '"') {
          output += '  ';
          index += 2;
          continue;
        }
        const literalChar = sql[index];
        output += literalChar === '\n' ? '\n' : ' ';
        index += 1;
        if (literalChar === '"') break;
      }
      continue;
    }

    if (char === '$') {
      const tagMatch = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        output += ' '.repeat(tag.length);
        index += tag.length;
        const endIndex = sql.indexOf(tag, index);
        const literalEnd = endIndex === -1 ? sql.length : endIndex;
        while (index < literalEnd) {
          output += sql[index] === '\n' ? '\n' : ' ';
          index += 1;
        }
        if (endIndex !== -1) {
          output += ' '.repeat(tag.length);
          index += tag.length;
        }
        continue;
      }
    }

    output += char;
    index += 1;
  }
  return output;
}

export function splitTopLevelStatements(scrubbedSql: string): string[] {
  return scrubbedSql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function detectOperation(statement: string): string {
  const match = statement.match(/^\s*([A-Za-z]+)/);
  if (!match) return 'UNKNOWN';
  const first = match[1]!.toUpperCase();
  if (first === 'START' && /^\s*START\s+TRANSACTION\b/i.test(statement)) return 'BEGIN';
  if (first === 'COPY') {
    if (/\bFROM\b/i.test(statement)) return 'COPY_FROM';
    if (/\bTO\b/i.test(statement)) return 'COPY_TO';
  }
  if (first === 'LOAD') return 'LOAD_DATA';
  if (first === 'UNLOAD') return 'UNLOAD';
  if (first === 'SELECT' && /\bINTO\b/i.test(statement)) return 'SELECT_INTO';
  return first;
}

function classifyType(operation: string): QueryClassificationType {
  if (READ_OPERATIONS.has(operation)) return 'read';
  if (WRITE_OPERATIONS.has(operation) || operation === 'SELECT_INTO') return 'write';
  if (DDL_OPERATIONS.has(operation) || operation === 'VACUUM' || operation === 'OPTIMIZE') return 'ddl';
  if (DCL_OPERATIONS.has(operation)) return 'dcl';
  if (TRANSACTION_OPERATIONS.has(operation)) return 'transaction';
  if (PROCEDURE_OPERATIONS.has(operation)) return 'procedure';
  if (operation === 'COPY_FROM' || operation === 'LOAD_DATA') return 'write';
  if (operation === 'COPY_TO' || operation === 'UNLOAD') return 'read';
  return 'unknown';
}

function policyOperationFor(operation: string, type: QueryClassificationType, statement: string): PolicyOperationKey {
  if (operation === 'EXPLAIN') return 'explain';
  if (operation === 'INSERT') return 'insert';
  if (operation === 'UPDATE') return 'update';
  if (operation === 'DELETE') return 'delete';
  if (operation === 'TRUNCATE') return 'truncate';
  if (operation === 'DROP') return 'drop';
  if (operation === 'ALTER') return 'alter';
  if (operation === 'GRANT' || operation === 'REVOKE') return 'grant';
  if (operation === 'VACUUM' || operation === 'OPTIMIZE') return 'vacuum';
  if (operation === 'COPY_FROM' || operation === 'LOAD_DATA') return 'import';
  if (operation === 'COPY_TO' || operation === 'UNLOAD' || operation === 'SELECT_INTO' || /\bEXPORT\b/i.test(statement)) return 'export';
  if (type === 'transaction') return 'transaction';
  if (type === 'procedure') return 'procedure';
  if (type === 'ddl') return 'ddl';
  return 'read';
}

function extractAffectedTables(statement: string, operation: string): string[] {
  const patterns: RegExp[] = [];
  if (operation === 'SELECT' || operation === 'WITH' || operation === 'EXPLAIN') {
    patterns.push(/\bFROM\s+([A-Za-z_][\w.$"]*)/gi, /\bJOIN\s+([A-Za-z_][\w.$"]*)/gi);
  } else if (operation === 'INSERT') {
    patterns.push(/\bINTO\s+([A-Za-z_][\w.$"]*)/gi);
  } else if (operation === 'UPDATE') {
    patterns.push(/\bUPDATE\s+([A-Za-z_][\w.$"]*)/gi);
  } else if (operation === 'DELETE') {
    patterns.push(/\bFROM\s+([A-Za-z_][\w.$"]*)/gi);
  } else if (operation === 'DROP' || operation === 'ALTER' || operation === 'TRUNCATE' || operation === 'CREATE') {
    patterns.push(/\b(?:TABLE|VIEW|INDEX|SCHEMA|DATABASE)\s+(?:IF\s+(?:EXISTS|NOT\s+EXISTS)\s+)?([A-Za-z_][\w.$"]*)/gi);
  } else if (operation === 'COPY_FROM' || operation === 'COPY_TO') {
    patterns.push(/\bCOPY\s+([A-Za-z_][\w.$"]*)/gi);
  }

  const names = new Set<string>();
  for (const pattern of patterns) {
    for (const match of statement.matchAll(pattern)) {
      const table = cleanIdentifier(match[1] ?? '');
      if (table && !isKeyword(table)) names.add(table);
    }
  }
  return [...names];
}

function extractSchemas(tables: string[]): string[] {
  const schemas = new Set<string>();
  for (const table of tables) {
    const parts = table.split('.');
    if (parts.length > 1) schemas.add(parts[0]!);
  }
  return [...schemas];
}

function detectDangerousPatterns(statement: string, operation: string, statementCount: number): string[] {
  const patterns: string[] = [];
  if (statementCount > 1) patterns.push('multi_statement');
  if (operation === 'DELETE' && !/\bWHERE\b/i.test(statement)) patterns.push('delete_without_where');
  if (operation === 'UPDATE' && !/\bWHERE\b/i.test(statement)) patterns.push('update_without_where');
  if (operation === 'DROP' && /\bDATABASE\b/i.test(statement)) patterns.push('drop_database');
  if (operation === 'DROP') patterns.push('drop_object');
  if (operation === 'TRUNCATE') patterns.push('truncate_table');
  if (operation === 'GRANT' || operation === 'REVOKE') patterns.push('privilege_change');
  if (operation === 'COPY_TO' || operation === 'UNLOAD' || operation === 'SELECT_INTO') patterns.push('data_export');
  if (operation === 'COPY_FROM' || operation === 'LOAD_DATA') patterns.push('data_import');
  return patterns;
}

function estimateSubqueryDepth(statement: string): number {
  let depth = 0;
  let maxDepth = 0;
  const tokens = statement.match(/\(|\)|\bSELECT\b/gi) ?? [];
  for (const token of tokens) {
    if (token === '(') depth += 1;
    else if (token === ')') depth = Math.max(0, depth - 1);
    else if (/SELECT/i.test(token) && depth > 0) maxDepth = Math.max(maxDepth, depth);
  }
  return maxDepth;
}

function isSensitiveOperation(policyOperation: PolicyOperationKey, operation: string, dangerousPatterns: string[]): boolean {
  return dangerousPatterns.length > 0
    || ['delete', 'update', 'truncate', 'drop', 'alter', 'ddl', 'grant', 'vacuum', 'procedure', 'import', 'export'].includes(policyOperation)
    || operation === 'COMMIT';
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function cleanIdentifier(identifier: string): string {
  return identifier.replace(/["`\[\]]/g, '').replace(/,$/, '').trim();
}

function isKeyword(identifier: string): boolean {
  return ['SELECT', 'WHERE', 'JOIN', 'ON', 'USING', 'VALUES', 'SET'].includes(identifier.toUpperCase());
}
