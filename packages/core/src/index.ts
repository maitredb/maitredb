export { MaitreError, MaitreErrorCode, EXIT_SUCCESS, EXIT_USER_ERROR, EXIT_GOVERNANCE_VIOLATION, EXIT_SYSTEM_ERROR, exitCodeForError } from './errors.js';
export { ConfigManager } from './config.js';
export type { MaitreConfig } from './config.js';
export { QueryExecutor, isDDL } from './executor.js';
export type { ExecutorOptions } from './executor.js';
export { ArrowResult } from './arrow-result.js';
export { rowsToRecordBatch, recordBatchToRows, batchRows, maitreTypeToArrow } from './arrow-utils.js';
export { GenericPool } from './generic-pool.js';
export type { GenericPoolFactory, PoolStats } from './generic-pool.js';
export { ConnectionManager } from './connection-manager.js';
export type { ManagedConnection, ConnectionManagerOptions } from './connection-manager.js';
export { HistoryStore } from './history.js';
export type { HistoryStoreOptions, HistoryQueryOptions } from './history.js';
export { getFormatter, autoDetectFormat } from './formatters.js';
export type { OutputFormat, Formatter } from './formatters.js';
export type { AuditEntry, CacheOptions, HistoryOptions } from './types.js';
export {
  CredentialManager,
  EnvironmentCredentialBackend,
  KeychainCredentialBackend,
  EncryptedFileCredentialBackend,
} from './credentials.js';
export type {
  Credential,
  PasswordCredential,
  KeyPairCredential,
  TokenCredential,
  ServiceAccountCredential,
  IamCredential,
  DsnCredential,
  CredentialBackend,
  CredentialManagerOptions,
} from './credentials.js';
