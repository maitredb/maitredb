import { createHash } from 'node:crypto';

export interface PreparedStatement {
  name: string;
  sql: string;
  createdAt: number;
  lastUsedAt: number;
  uses: number;
}

export interface PreparedStatementCacheOptions {
  maxSize?: number;
  prefix?: string;
  onEvict?: (statement: PreparedStatement) => void | Promise<void>;
}

const DEFAULT_MAX_SIZE = 256;

export class PreparedStatementCache {
  private readonly statements = new Map<string, PreparedStatement>();
  private readonly maxSize: number;
  private readonly prefix: string;

  constructor(private readonly options: PreparedStatementCacheOptions = {}) {
    this.maxSize = Math.max(0, options.maxSize ?? DEFAULT_MAX_SIZE);
    this.prefix = options.prefix ?? 'mdb_ps';
  }

  get size(): number {
    return this.statements.size;
  }

  getOrCreate(sql: string): PreparedStatement | undefined {
    if (this.maxSize === 0 || !isPreparedStatementEligible(sql)) return undefined;

    const key = statementKey(sql);
    const existing = this.statements.get(key);
    const now = Date.now();

    if (existing) {
      existing.lastUsedAt = now;
      existing.uses += 1;
      this.statements.delete(key);
      this.statements.set(key, existing);
      return existing;
    }

    const statement: PreparedStatement = {
      name: `${this.prefix}_${key}`,
      sql,
      createdAt: now,
      lastUsedAt: now,
      uses: 1,
    };

    this.statements.set(key, statement);
    this.evictIfNeeded();
    return statement;
  }

  has(sql: string): boolean {
    return this.statements.has(statementKey(sql));
  }

  clear(): PreparedStatement[] {
    const evicted = [...this.statements.values()];
    this.statements.clear();
    return evicted;
  }

  entries(): PreparedStatement[] {
    return [...this.statements.values()];
  }

  private evictIfNeeded(): void {
    while (this.statements.size > this.maxSize) {
      const oldestKey = this.statements.keys().next().value as string | undefined;
      if (!oldestKey) return;

      const evicted = this.statements.get(oldestKey);
      this.statements.delete(oldestKey);
      if (evicted) void this.options.onEvict?.(evicted);
    }
  }
}

export function statementKey(sql: string): string {
  return createHash('sha256').update(normalizeSql(sql)).digest('hex').slice(0, 24);
}

export function isPreparedStatementEligible(sql: string): boolean {
  const trimmed = sql.trim();
  if (trimmed.length === 0) return false;
  return countSqlStatements(trimmed) === 1;
}

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ');
}

function countSqlStatements(sql: string): number {
  let statements = 0;
  let hasToken = false;
  let quote: 'single' | 'double' | 'dollar' | undefined;
  let dollarTag = '';

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index]!;
    const next = sql[index + 1];

    if (quote === 'single') {
      if (char === "'" && next === "'") index += 1;
      else if (char === "'") quote = undefined;
      continue;
    }

    if (quote === 'double') {
      if (char === '"') quote = undefined;
      continue;
    }

    if (quote === 'dollar') {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        quote = undefined;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      while (index < sql.length && sql[index] !== '\n') index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      index += 2;
      while (index < sql.length && !(sql[index] === '*' && sql[index + 1] === '/')) index += 1;
      index += 1;
      continue;
    }

    if (char === "'") {
      quote = 'single';
      hasToken = true;
      continue;
    }

    if (char === '"') {
      quote = 'double';
      hasToken = true;
      continue;
    }

    if (char === '$') {
      const tagMatch = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(index));
      if (tagMatch) {
        dollarTag = tagMatch[0];
        quote = 'dollar';
        index += dollarTag.length - 1;
        hasToken = true;
        continue;
      }
    }

    if (char === ';') {
      if (hasToken) statements += 1;
      hasToken = false;
      continue;
    }

    if (!/\s/.test(char)) hasToken = true;
  }

  if (hasToken) statements += 1;
  return statements;
}