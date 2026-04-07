# Maître d'B — Change Log

> Chronological record of all changes, improvements, and fixes.
> Follows [Keep a Changelog](https://keepachangelog.com/) format.

## [v0.1.0a] — 2026-04-07

### Added

- **Credential store with pluggable backends (Phase 1a)**
  - `CredentialManager` in `@maitredb/core` with resolution chain: env vars → system keychain → encrypted file
  - **Environment variable backend**: reads `MDB_CONN_<NAME>_PASSWORD`, `MDB_CONN_<NAME>_DSN`, `MDB_CONN_<NAME>_TOKEN`, `MDB_CONN_<NAME>_KEY_FILE`
  - **Keychain backend**: system keychain via `keytar` (optional dep) — macOS Keychain, Windows Credential Vault, Linux libsecret
  - **Encrypted file backend**: `~/.maitredb/credentials.enc` — AES-256-GCM encryption, PBKDF2 key derivation (310,000 iterations, SHA-256), per-entry IVs, file permissions 0600
  - Machine fingerprint (hostname + username) mixed into key derivation to prevent credential file portability
  - Optional master password support for stronger protection
  - Pluggable `CredentialBackend` interface for future vault integrations (HashiCorp Vault, AWS Secrets Manager, etc.)

- **Multi-method authentication type system**
  - `Credential` union type covering 6 auth methods: `password`, `key-pair`, `token`, `service-account`, `iam`, `dsn`
  - `PasswordCredential` — simple username/password (PostgreSQL, MySQL, etc.)
  - `KeyPairCredential` — private key path + optional passphrase (Snowflake, PG certificate, SSH tunnel)
  - `TokenCredential` — OAuth access/refresh tokens with expiry timestamps (Snowflake SSO, BigQuery)
  - `ServiceAccountCredential` — key file path (GCP, BigQuery ADC)
  - `IamCredential` — AWS IAM profile/role ARN, GCP ADC (no stored secret, runtime-resolved)
  - `DsnCredential` — full connection string with embedded credentials
  - `AuthMethod` type on `ConnectionConfig` for per-connection auth preference ordering

- **Secure credential handling in CLI**
  - `mdb connect add` now accepts `--password` and `--key-file` flags; credentials stored securely, never in `connections.json`
  - DSN parsing extracts and separately stores passwords from connection strings
  - `mdb connect remove` now also deletes associated credentials from all backends
  - `mdb connect list` shows which credential backend holds each connection's credentials
  - `--auth` flag for specifying auth method preference order per connection

- **ConfigManager credential integration**
  - `ConfigManager.credentials` — lazy-initialized `CredentialManager` accessor
  - `getCredential()` / `storeCredential()` methods for secure credential access
  - `removeConnectionWithCredentials()` for atomic connection + credential cleanup
  - Credentials never written to `connections.json` — strict separation of metadata and secrets

- **Comprehensive credential test suite (31 tests)**
  - Environment backend: resolution of all 4 env var patterns, hyphen-to-underscore conversion, listing, read-only enforcement
  - Encrypted file backend: round-trip for all credential types, multi-credential independence, overwrite, delete, wrong-password detection, file permission verification, plaintext non-exposure
  - Credential manager: resolution chain priority, fallthrough, store routing, cross-backend listing, backend location, custom backend injection

### Platform Support

- **Cross-platform credential storage**: Works on Windows 10/11, macOS, Linux (all distros), and containers
- **Graceful degradation**: Automatically falls back to encrypted file backend when system keychain is unavailable
- **Backwards compatible**: No breaking changes; existing connections continue to work
- **CI/CD friendly**: Environment variable backend ideal for automated environments

### Security

- **AES-256-GCM encryption** for credentials at rest
- **PBKDF2 with 310,000 iterations** for key derivation (OWASP 2023 recommendation)
- **Machine fingerprint** prevents credential file portability
- **File permissions 0600** ensures only owner can read credentials
- **No plaintext secrets** in configuration files or logs

## [v0.0.2] — 2026-04-07

- **Timing statistics for all query and schema operations**
  - Query results now automatically include execution timing in all output formats
  - Table format shows: `(X rows) (Y.YY ms)` in footer
  - JSON format includes full metadata with `durationMs` field
  - Schema commands (`mdb schema tables`, `mdb schema columns`, etc.) now show timing
  - Empty results show timing: `(0 rows) (X.XX ms)`
  - Implementation in `QueryExecutor.execute()` and schema command handlers
  - Updated all formatters to handle timing display

## [v0.0.1] — 2026-04-07

### Added

- **Core architecture and SQLite support**
  - Monorepo scaffold with pnpm workspace + Turborepo
  - Package structure: `@maitredb/cli`, `@maitredb/core`, `@maitredb/plugin-api`, `@maitredb/driver-sqlite`
  - Shared configuration: tsconfig, ESLint, vitest
  - Build pipeline with turbo.json

- **Error handling and core types**
  - `MaitreError` class with error codes
  - `MaitreType` union type system
  - `DatabaseDialect` type support
  - Connection configuration types
  - Exit code constants

- **Configuration system**
  - Layered config: CLI flags > env vars > project config > user config > defaults
  - `ConfigManager` class
  - Connection config file reader (`connections.json`)
  - Default output format and max rows configuration

- **Driver architecture**
  - `DriverAdapter` interface in `@maitredb/plugin-api`
  - `DriverCapabilities` interface
  - `PluginRegistry` for lazy-loading drivers
  - SQLite driver implementation with `better-sqlite3`
  - Full `DriverAdapter` implementation: connect, disconnect, execute, stream
  - Schema introspection: getSchemas, getTables, getColumns, getIndexes
  - Basic EXPLAIN support via `EXPLAIN QUERY PLAN`

- **Query execution**
  - `QueryExecutor` class in `@maitredb/core`
  - Streaming-first design with `stream()` returning `AsyncIterable<Row>`
  - `execute()` method with `MAX_BUFFERED_ROWS` safety
  - `QueryResult` model with rows, fields, and row count
  - DDL detection for future cache invalidation

- **Output formatters**
  - Table format with `cli-table3` (aligned columns)
  - JSON format with pretty printing
  - CSV format with proper escaping
  - NDJSON format (one object per line)
  - Raw format (tab-separated)
  - Auto-detection: TTY → table, piped → ndjson

- **CLI interface**
  - `mdb query <conn> "SQL"` with `--format` flag
  - `mdb connect add/remove/list/test` commands
  - `mdb schema <conn> tables/columns/indexes` commands
  - Version and help flags
  - Structured JSON error output on stderr
  - Correct exit codes

- **Testing infrastructure**
  - Unit tests for config, errors, types, formatters
  - Integration tests for SQLite driver
  - CLI e2e tests with execa
  - Vitest configuration

### Known Limitations (v0.0.1)

- No Arrow/Rust wire parser (plain JS objects only)
- No connection pooling (single connection per invocation)
- No credential encryption (passwords in plaintext)
- No caching layer
- No governance/masking features
- No GUI
- SQLite driver only (PostgreSQL, MySQL, etc. planned for v0.1.0)

[Unreleased]: https://github.com/maitredb/maitredb/compare/v0.0.1...HEAD
[v0.0.1]: https://github.com/maitredb/maitredb/releases/tag/v0.0.1
