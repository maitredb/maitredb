import type { DatabaseDialect } from '@maitredb/plugin-api';
import type { MaitreErrorCode } from './errors.js';

/**
 * One query/audit record persisted to local history storage.
 */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  connection: string;
  dialect: DatabaseDialect;
  caller: 'human' | 'agent' | 'programmatic';
  query: string;
  params?: unknown[];
  durationMs: number;
  rowsAffected?: number;
  rowsReturned?: number;
  error?: {
    code: MaitreErrorCode;
    message: string;
  };
  policyApplied?: string;
}

/**
 * Cache configuration for introspection + permission metadata.
 */
export interface CacheOptions {
  enabled?: boolean;
  memoryMaxItems?: number;
  diskEnabled?: boolean;
  diskPath?: string;
  schemaTtlMs?: number;
  permissionTtlMs?: number;
  queryResultCaching?: boolean;
}

/**
 * Query history storage options.
 */
export interface HistoryOptions {
  enabled?: boolean;
  dbPath?: string;
  maxSizeMb?: number;
  logParamsForProduction?: boolean;
}
