[**maitredb v0.0.1**](../../../README.md)

***

# packages/core/src

## Enumerations

- [MaitreErrorCode](enumerations/MaitreErrorCode.md)

## Classes

- [ConfigManager](classes/ConfigManager.md)
- [ConnectionManager](classes/ConnectionManager.md)
- [CredentialManager](classes/CredentialManager.md)
- [EncryptedFileCredentialBackend](classes/EncryptedFileCredentialBackend.md)
- [EnvironmentCredentialBackend](classes/EnvironmentCredentialBackend.md)
- [GenericPool](classes/GenericPool.md)
- [HistoryStore](classes/HistoryStore.md)
- [KeychainCredentialBackend](classes/KeychainCredentialBackend.md)
- [MaitreError](classes/MaitreError.md)
- [QueryExecutor](classes/QueryExecutor.md)

## Interfaces

- [AuditEntry](interfaces/AuditEntry.md)
- [CacheOptions](interfaces/CacheOptions.md)
- [ConnectionManagerOptions](interfaces/ConnectionManagerOptions.md)
- [CredentialBackend](interfaces/CredentialBackend.md)
- [CredentialManagerOptions](interfaces/CredentialManagerOptions.md)
- [DsnCredential](interfaces/DsnCredential.md)
- [ExecutorOptions](interfaces/ExecutorOptions.md)
- [Formatter](interfaces/Formatter.md)
- [GenericPoolFactory](interfaces/GenericPoolFactory.md)
- [HistoryOptions](interfaces/HistoryOptions.md)
- [HistoryQueryOptions](interfaces/HistoryQueryOptions.md)
- [HistoryStoreOptions](interfaces/HistoryStoreOptions.md)
- [IamCredential](interfaces/IamCredential.md)
- [KeyPairCredential](interfaces/KeyPairCredential.md)
- [MaitreConfig](interfaces/MaitreConfig.md)
- [ManagedConnection](interfaces/ManagedConnection.md)
- [PasswordCredential](interfaces/PasswordCredential.md)
- [PoolStats](interfaces/PoolStats.md)
- [ServiceAccountCredential](interfaces/ServiceAccountCredential.md)
- [TokenCredential](interfaces/TokenCredential.md)

## Type Aliases

- [Credential](type-aliases/Credential.md)
- [OutputFormat](type-aliases/OutputFormat.md)

## Variables

- [EXIT\_GOVERNANCE\_VIOLATION](variables/EXIT_GOVERNANCE_VIOLATION.md)
- [EXIT\_SUCCESS](variables/EXIT_SUCCESS.md)
- [EXIT\_SYSTEM\_ERROR](variables/EXIT_SYSTEM_ERROR.md)
- [EXIT\_USER\_ERROR](variables/EXIT_USER_ERROR.md)

## Functions

- [autoDetectFormat](functions/autoDetectFormat.md)
- [exitCodeForError](functions/exitCodeForError.md)
- [getFormatter](functions/getFormatter.md)
- [isDDL](functions/isDDL.md)
