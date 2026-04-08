import type { DatabaseDialect } from '@maitredb/plugin-api';

/**
 * Build a canonical cache key for metadata and permission operations.
 */
export function buildCacheKey(
  connectionId: string,
  dialect: DatabaseDialect,
  operation: string,
  schema?: string,
  object?: string,
): string {
  const schemaPart = schema && schema.length > 0 ? schema : '*';
  const objectPart = object && object.length > 0 ? object : '*';
  return `${connectionId}:${dialect}:${operation}:${schemaPart}:${objectPart}`;
}

/**
 * Build a regular expression used to invalidate keys by scope.
 */
export function invalidationPattern(
  connectionId: string,
  dialect: DatabaseDialect,
  scope: 'schema' | 'permissions' | 'all',
): RegExp {
  const prefix = escapeRegExp(`${connectionId}:${dialect}:`);
  if (scope === 'all') {
    return new RegExp(`^${prefix}`);
  }

  const operations = scope === 'schema'
    ? ['schemas', 'tables', 'columns', 'indexes', 'functions', 'procedures', 'types']
    : ['roles', 'grants'];

  return new RegExp(`^${prefix}(?:${operations.join('|')}):`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
