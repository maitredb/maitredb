# Copilot Instructions for maitredb

This document provides guidance for Copilot and other AI assistants working in this repository.

## Build, Test & Lint

**Workspace root commands** (using Turborepo):
```bash
pnpm build                    # Build all packages and apps
pnpm test                     # Run full test suite across monorepo
pnpm lint                     # Type-check all packages (tsc --noEmit)
pnpm dev                      # Watch mode for all packages
pnpm clean                    # Remove dist, .tsbuildinfo, caches
pnpm docs:reference           # Generate TypeDoc API reference into docs/reference/
```

**Single package commands** (from package directory):
```bash
cd packages/core
pnpm test                     # Run vitest for this package only
pnpm test --watch            # Watch mode for single package
pnpm test --grep pattern     # Run specific tests by pattern
```

**CLI e2e testing** (from apps/cli):
```bash
cd apps/cli
pnpm test                     # Uses execa to test CLI as child process
```

## High-Level Architecture

### Streaming-First Design
- All data flows as `AsyncIterable<RecordBatch>` (Apache Arrow)
- Buffered `execute()` is syntactic sugar on top of `stream()`
- Never buffer entire result sets before consumer sees first row
- The `row` iterator uses a Proxy that reads from Arrow column buffers on access

### Driver Adapter Contract
Every database implementation must satisfy the `DriverAdapter` interface from `@maitredb/plugin-api`:
- Core methods: `connect()`, `disconnect()`, `execute()`, `stream()`, `streamBatches()`
- Introspection: `getSchemas()`, `getTables()`, `getColumns()`, `getIndexes()`, etc.
- Transactions: `beginTransaction()`, `cancelQuery()`
- Each driver reports `capabilities()` for graceful degradation
- Optional `streamBatches?()` for native Arrow support (DuckDB, ClickHouse, etc.)

### Arrow-Native Hot Path
- Wire protocol bytes → Rust parser (`@maitredb/wire` via napi-rs) → Arrow RecordBatch
- Minimize JS↔Rust boundary crossings; parse entire result buffer in one call
- Never create per-row JS objects on hot path — read from Arrow column buffers via Proxy

### Error Model
- Unified error codes across all databases: 1xxx=connection, 2xxx=query, 3xxx=governance, 4xxx=transaction, 9xxx=system
- Exit codes: 0=success, 1=user error, 2=governance violation, 3=system error
- Use `MaitreError` with typed `MaitreErrorCode` — never throw raw strings
- Define in `packages/plugin-api/src/types.ts`

### File Over App Philosophy
- Config, credentials, and workflows live in open formats (JSON, SQL, Iceberg/Parquet)
- All data remains accessible if maitredb is uninstalled
- No telemetry, no vendor lock-in, no proprietary formats
- Configuration precedence: CLI flags > env vars (`MDB_*`) > project config (`./.maitredb/`) > user config (`~/.maitredb/`) > defaults

### Lazy Loading & Optional Dependencies
- Drivers are lazy-loaded (don't import `snowflake-sdk` until Snowflake connection requested)
- Native modules (`better-sqlite3`, `keytar`, `@maitredb/wire`) are optional with pure-JS fallbacks
- `npx maitredb query` must work zero-install with cold start under 2 seconds

### Cloud Warehouse Pattern
- BigQuery, Athena, Redshift use async job polling internally
- Expose same sync-looking `execute()`/`stream()` interface to consumers
- Handle polling transparency without blocking user code

## Monorepo Structure

```
apps/cli/              — @maitredb/cli (the `mdb` binary, yargs-based)
apps/gui/              — @maitredb/gui (Tauri 2 desktop app, React + Vite + TailwindCSS)
packages/core/         — Connection manager, query executor, introspection, caching
packages/wire/         — Rust native addon (napi-rs) — wire protocol parsing → Apache Arrow
packages/cache/        — Memory LRU + SQLite disk cache (better-sqlite3)
packages/governance/   — Agent security, query validation, data masking
packages/faker/        — Schema-aware fake data generation
packages/dump/         — Universal dump to Parquet/Iceberg/CSV/SQL
packages/driver-*/     — One package per database (11 total)
packages/plugin-api/   — DriverAdapter interface + type definitions + plugin registry
```

### Supported Databases (11)
SQLite, PostgreSQL, MySQL/MariaDB, MongoDB, Snowflake, ClickHouse, DuckDB, BigQuery, Redshift, Athena

## Key Conventions

### Package Configuration
- Each package has its own `package.json`, `tsconfig.json`, `vitest.config.ts`
- Packages export via `"exports"` in package.json for controlled API surface
- Workspace dependencies use `workspace:*` protocol in package.json
- Dev dependencies go in each package, not root

### TypeScript
- Target: ES2020, Module: ESNext
- Type everything; no implicit `any`
- Use const assertions (`as const`) for literal types
- Leverage TypeScript's readonly and discriminated unions for type safety

### Error Handling
- Define typed error codes in `packages/plugin-api/src/types.ts` as `MaitreErrorCode` type
- Throw `MaitreError` with code, message, context object
- Don't suppress errors in streaming—propagate them to consumer via async iteration
- Test error paths explicitly; don't silently catch

### Testing
- Unit tests: vitest with `.test.ts` or `.spec.ts` suffix
- Integration tests: testcontainers for database testing (Docker-based)
- CLI e2e tests: execa to spawn `mdb` as child process
- Place tests in `__tests__` directory alongside source or in same directory as `.test.ts` suffix

### Streaming Patterns
- Return `AsyncIterable<T>` not `Promise<T[]>`
- Always implement proper cancellation: check for abort signals, clean up resources
- Use `for await (const batch of stream)` in consumers
- Backpressure is handled by async iteration protocol—don't buffer unnecessarily

### Driver Implementation
- Extend/implement `DriverAdapter` from `@maitredb/plugin-api`
- In `connect()`: store config and native driver in `Connection` object's `native` field
- In `stream()`: yield per-row objects `Record<string, unknown>` or handle native Arrow via `streamBatches?()`
- In introspection methods: map native types to `MaitreType` using `mapNativeType()`
- Always implement `capabilities()` to declare feature support (sorting, limits, transactions, etc.)

### Transaction Model
- Implement `beginTransaction()` returning a `Transaction` object
- `Transaction` has `commit()` and `rollback()` methods
- Cloud data warehouses may not support traditional ACID—declare via `capabilities().supportsTransactions`
- Streaming within a transaction must remain transactional

### Naming Conventions
- Packages: kebab-case (e.g., `@maitredb/driver-postgres`)
- Files: kebab-case (e.g., `query-executor.ts`)
- Types/classes: PascalCase (e.g., `QueryExecutor`, `DriverAdapter`)
- Functions/variables: camelCase (e.g., `executeQuery()`, `connConfig`)

### Arrow Type Mapping
- All drivers should map native database types to Apache Arrow types
- Implement `mapNativeType(nativeType: string): MaitreType` in each driver
- Common mappings: VARCHAR→utf8, INT→int32, BIGINT→int64, DECIMAL→decimal128, TIMESTAMP→timestamp, etc.

## Architecture Reference

For comprehensive design details, see:
- `spec/architecture.md` — Full architecture, design rationale, and system interactions
- `spec/implementation-plan.md` — Phased delivery roadmap and feature backlog
- CLAUDE.md — Code quality expectations and design constraints

## Important Patterns

### Graceful Degradation
- Query execution should succeed even if advanced features (full-text search, JSON functions, etc.) aren't available
- Use `capabilities()` to declare what's supported; let consumers adapt
- Example: If a driver can't do sorting, handle client-side or document limitation

### Config Hierarchy
```
CLI flags (highest priority)
  ↓
Environment variables (MDB_*)
  ↓
Project config (./.maitredb/)
  ↓
User config (~/.maitredb/)
  ↓
Defaults (lowest priority)
```

### Masking as Streaming Transform
- Data masking runs on streamed rows, not post-processing buffers
- Apply masks in the stream pipeline before yielding to consumer
- Supports per-role masking policies from governance package

### Cold Start Performance
- CLI must start in <2 seconds on first run (zero-install)
- Lazy-load drivers: only import when connection type is known
- Cache introspection results aggressively (but respect `--no-cache` flag)
- Use `packages/cache` for both memory and disk caching

## Testing Strategy

- **Unit tests**: Pure functions, error cases, type checking
- **Integration tests**: Real databases via testcontainers, connection pooling, transactions
- **E2E CLI tests**: Spawn `mdb` binary via execa, test actual command execution
- **Performance tests**: Benchmark hot paths (Arrow parsing, streaming throughput)
- Test error codes explicitly; verify exit codes in CLI tests

---

For questions about code organization, driver patterns, or architectural decisions, consult `spec/architecture.md` first.
