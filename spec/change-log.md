# Maître d'B — Change Log

> Chronological record of all changes, improvements, and fixes.
> Follows [Keep a Changelog](https://keepachangelog.com/) format.

## [Unreleased]

### Added

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
