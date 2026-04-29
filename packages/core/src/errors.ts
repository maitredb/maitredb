import type { DatabaseDialect } from '@maitredb/plugin-api';

export enum MaitreErrorCode {
  // Connection errors (1xxx)
  CONNECTION_FAILED = 1001,
  CONNECTION_TIMEOUT = 1002,
  AUTHENTICATION_FAILED = 1003,
  CONNECTION_LOST = 1004,
  SSL_ERROR = 1005,
  TUNNEL_FAILED = 1006,
  POOL_EXHAUSTED = 1007,

  // Query errors (2xxx)
  SYNTAX_ERROR = 2001,
  EXECUTION_ERROR = 2002,
  QUERY_TIMEOUT = 2003,
  QUERY_CANCELLED = 2004,
  RESULT_TOO_LARGE = 2005,
  PERMISSION_DENIED = 2006,
  RELATION_NOT_FOUND = 2007,

  // Governance errors (3xxx)
  POLICY_VIOLATION = 3001,
  READ_ONLY_VIOLATION = 3002,
  RATE_LIMITED = 3003,
  SCHEMA_NOT_ALLOWED = 3004,
  OPERATION_BLOCKED = 3005,
  EXPLAIN_REQUIRED = 3006,
  APPROVAL_REQUIRED = 3007,
  APPROVAL_EXPIRED = 3008,

  // Transaction errors (4xxx)
  TRANSACTION_FAILED = 4001,
  DEADLOCK = 4002,
  SERIALIZATION_FAILURE = 4003,

  // System errors (9xxx)
  DRIVER_NOT_FOUND = 9001,
  PLUGIN_LOAD_FAILED = 9002,
  CACHE_ERROR = 9003,
  CONFIG_ERROR = 9004,
  INTERNAL_ERROR = 9999,
}

export class MaitreError extends Error {
  constructor(
    public readonly code: MaitreErrorCode,
    message: string,
    public readonly dialect?: DatabaseDialect,
    public readonly nativeCode?: string | number,
    public readonly suggestion?: string,
  ) {
    super(message);
    this.name = 'MaitreError';
  }

  toJSON() {
    return {
      error: MaitreErrorCode[this.code],
      code: this.code,
      message: this.message,
      dialect: this.dialect,
      nativeCode: this.nativeCode,
      suggestion: this.suggestion,
    };
  }
}

export const EXIT_SUCCESS = 0;
export const EXIT_USER_ERROR = 1;
export const EXIT_GOVERNANCE_VIOLATION = 2;
export const EXIT_SYSTEM_ERROR = 3;

export function exitCodeForError(err: MaitreError): number {
  if (err.code >= 3000 && err.code < 4000) return EXIT_GOVERNANCE_VIOLATION;
  if (err.code >= 9000) return EXIT_SYSTEM_ERROR;
  return EXIT_USER_ERROR;
}
