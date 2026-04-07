# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Maître d'B** (`maitredb`) — a cross-platform database client (CLI + GUI) for humans and AI agents. Handles pooling, query sequencing, credential isolation, and schema introspection as middleware between consumers and databases.

**CLI command**: `mdb` | **Org scope**: `@maitredb/*`

This is a greenfield project. The architecture is fully designed in `architecture.md` but implementation has not started. All code changes should align with that document.

## Planned Tech Stack

- **Monorepo**: pnpm + Turborepo
- **Language**: TypeScript (core) + Rust (wire protocol parser via napi-rs)
- **CLI**: yargs
- **GUI**: Tauri 2 + React + Vite + TailwindCSS
- **Internal data format**: Apache Arrow (columnar, zero-copy)
- **Testing**: vitest (unit), testcontainers (integration), execa (CLI e2e)
- **Target runtimes**: Node.js 20 LTS, 22 LTS

## Architecture (Key Points)

**Streaming-first**: All data flows as `AsyncIterable<RecordBatch>`. Buffered `execute()` is sugar on top of `stream()`. Never buffer entire result sets before the consumer sees the first row.

**Arrow-native**: Wire protocol bytes → Rust parser → Arrow RecordBatch. Never create per-row JS objects on the hot path. The `row` iterator uses a Proxy that reads from Arrow column buffers on access.

**Rust hot path** (`@maitredb/wire`): Cross the JS↔Rust boundary as few times as possible with large payloads. One call to parse an entire result buffer, not one call per row.

**Driver adapter contract**: Every database implements `DriverAdapter` with `capabilities()` for graceful degradation. Cloud warehouses (BigQuery, Athena, Redshift) use async job polling internally but expose the same sync-looking `execute()`/`stream()` interface.

**File Over App**: All config, credentials, queries, and exports use open, human-readable formats (JSON, SQL files, Iceberg/Parquet). Zero telemetry. If the user uninstalls maitredb, they can still access everything they created with it.

**Config precedence**: CLI flags > env vars (`MDB_*`) > project config (`./.maitredb/`) > user config (`~/.maitredb/`) > defaults.

## Monorepo Layout

```
apps/cli/          — @maitredb/cli (the `mdb` binary)
apps/gui/          — @maitredb/gui (Tauri 2 desktop app)
packages/core/     — Connection manager, query executor, introspection
packages/wire/     — Rust native addon (napi-rs) — protocol parsing → Arrow
packages/cache/    — Memory LRU + SQLite disk cache
packages/governance/ — Agent security, query validation, data masking
packages/faker/    — Schema-aware fake data generation
packages/dump/     — Universal dump to Parquet/Iceberg/CSV/SQL
packages/driver-*/ — One package per database (11 total)
packages/plugin-api/ — DriverAdapter interface + plugin registry
```

## Supported Databases (11)

SQLite, PostgreSQL, MySQL/MariaDB, MongoDB, Snowflake, ClickHouse, DuckDB, BigQuery, Redshift, Athena. Each is a separate `driver-*` package with a `DriverAdapter` implementation.

## Error Codes

Unified across all databases: 1xxx = connection, 2xxx = query, 3xxx = governance, 4xxx = transaction, 9xxx = system. Exit codes: 0 = success, 1 = user error, 2 = governance violation, 3 = system error. Use `MaitreError` with typed `MaitreErrorCode` — never throw raw strings.

## Key Design Constraints

- Native Node.js drivers only — no JDBC, no JVM
- Drivers are lazy-loaded (don't import snowflake-sdk until a Snowflake connection is requested)
- Native modules (`better-sqlite3`, `keytar`, `@maitredb/wire`) are optional dependencies with pure-JS fallbacks
- `npx maitredb query` must work zero-install with cold start under 2 seconds
- Agent mode (`--as agent`) skips interactive auth and enforces governance policies
- Masking runs as a streaming transform, never a post-processing buffer step
