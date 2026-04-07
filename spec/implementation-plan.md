# Maître d'B — Implementation Plan

> Ordered build plan from v0.0.1 MVP through v1.0.0 GA.
> Each milestone is a usable, shippable increment. Nothing is built "just in case."

---

## v0.0.1 — Skeleton & First Query (Milestone 0)

**Goal**: `mdb query dev "SELECT 1"` works end-to-end against SQLite with table output.

Everything below ships together as a single coordinated bootstrap. Nothing here is useful without the rest.

### 0a. Monorepo scaffold

- Initialize pnpm workspace + Turborepo
- Create package stubs: `apps/cli`, `packages/core`, `packages/plugin-api`, `packages/driver-sqlite`
- Shared tsconfig (base, node, react), ESLint config, vitest config
- `turbo.json` with `build`, `test`, `lint` pipelines
- Root `package.json` scripts: `build`, `test`, `lint`, `dev`
- CI: GitHub Actions running build + test on push

### 0b. Error taxonomy & core types

- `MaitreError` class with `MaitreErrorCode` enum (full enum from architecture — define once, never change)
- `MaitreType` union type (the unified type system)
- `DatabaseDialect` type
- `ConnectionConfig`, `ConnectionTestResult` types
- Exit code constants (0, 1, 2, 3)
- These live in `packages/core/src/types/` and are consumed everywhere

### 0c. Configuration hierarchy

- Config loader: CLI flags > env vars (`MDB_*`) > project config (`./.maitredb/`) > user config (`~/.maitredb/`) > defaults
- `ConfigManager` class that resolves the layered config
- Connection config file reader (`connections.json`)
- Minimal defaults: output format, max rows

### 0d. DriverAdapter interface & plugin registry

- `DriverAdapter` interface in `packages/plugin-api/`
- `DriverCapabilities` interface
- `PluginRegistry`: register adapters by dialect, look up by name
- Lazy-loading mechanism: driver modules loaded only when a connection of that type is requested

### 0e. SQLite driver

- `packages/driver-sqlite/` implementing `DriverAdapter`
- `better-sqlite3` as optional dep with error message if unavailable
- `connect()`, `disconnect()`, `testConnection()`, `execute()`, `stream()`
- `getSchemas()`, `getTables()`, `getColumns()`, `getIndexes()`
- `capabilities()` returning correct flags (no streaming, no roles, embedded: true, etc.)
- `mapNativeType()` mapping SQLite types to `MaitreType`
- Basic `explain()` via `EXPLAIN QUERY PLAN`

### 0f. Query executor (core)

- `QueryExecutor` in `packages/core/` — accepts a `DriverAdapter` + connection, runs queries
- Streaming-first: `stream()` returns `AsyncIterable<Row>`, `execute()` is sugar with `MAX_BUFFERED_ROWS` safety
- Result model: `QueryResult` wrapping rows + field metadata + row count
- For v0.0.1, results are plain JS objects (Arrow comes in a later milestone)
- DDL detection for future cache invalidation (flag queries starting with CREATE/ALTER/DROP)

### 0g. Output formatters

- `table` — aligned columns using `cli-table3` (default for TTY)
- `json` — `JSON.stringify` with 2-space indent
- `csv` — via `csv-stringify`
- `ndjson` — one JSON object per line (default for piped output)
- Auto-detection: TTY → table, piped → ndjson
- Formatter interface so more formats can be added later

### 0h. CLI shell (yargs)

- `apps/cli/` with yargs setup
- Commands for v0.0.1:
  - `mdb query <conn> "SQL"` — with `--format` flag
  - `mdb connect add <name>` — interactive prompts for type/host/port/user/database/password
  - `mdb connect test <name>`
  - `mdb connect list`
  - `mdb connect remove <name>`
  - `mdb schema <conn> tables`
  - `mdb schema <conn> columns <table>`
  - `mdb --version`, `mdb --help`
- `bin` field: `"mdb"` and `"maitredb"` both point to entry
- Error output: structured JSON on stderr, human-readable message, correct exit code

### What v0.0.1 does NOT include

- No Arrow / Rust wire parser (plain JS objects for now)
- No connection pooling (single connection per invocation)
- No credential encryption (passwords stored in plaintext in connections.json for now — flagged as insecure in output)
- No caching
- No governance / masking
- No GUI
- Only SQLite driver

### Tests for v0.0.1

- Unit: config loader precedence, error construction, type mapping, output formatters
- Integration: SQLite driver against a real temp database (vitest)
- CLI e2e: `mdb connect add`, `mdb query`, `mdb schema` via execa against a temp SQLite file

---

## v0.1.0 — PostgreSQL, MySQL, Credentials (Milestone 1)

**Goal**: Connect to real networked databases with proper credential management.

### 1a. Credential store

- `CredentialManager` with pluggable backends:
  - **Keychain** backend via `keytar` (optional dep)
  - **Encrypted file** backend: `~/.maitredb/credentials.enc` — AES-256-GCM, key from machine ID + master password
  - **Environment variable** backend: `MDB_CONN_<NAME>_DSN` / `MDB_CONN_<NAME>_PASSWORD`
- Credential resolution order: env var → keychain → encrypted file
- `mdb connect add` now prompts for password and stores it in the credential store (never in `connections.json`)
- Pure-JS fallback when `keytar` is unavailable

### 1b. PostgreSQL driver

- `packages/driver-postgres/` using `pg` v8
- Full `DriverAdapter` implementation including:
  - Streaming via cursor (`pg-cursor` or row-by-row mode)
  - Schema introspection from `information_schema` + `pg_catalog`
  - `getFunctions()`, `getProcedures()`, `getRoles()`, `getGrants()`
  - `explain()` via `EXPLAIN (FORMAT JSON)` and `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
  - `cancelQuery()` via `pg_cancel_backend`
  - Binary protocol mode (text fallback) — parse results in JS for now
  - Parameterized queries (`$1`, `$2`, ...)

### 1c. MySQL/MariaDB driver

- `packages/driver-mysql/` using `mysql2` v3
- Dialect flag for MariaDB-specific features
- Streaming via `connection.query().stream()`
- Schema introspection from `information_schema`
- `explain()` via `EXPLAIN FORMAT=JSON`
- Prepared statement support with `{ cachePreparedStatements: true }`

### 1d. DSN support

- `mdb connect add <name> --dsn "postgresql://user:pass@host:5432/dbname"`
- Parse DSN into connection config components
- Support DSN format for postgres, mysql, sqlite

### Tests for v0.1.0

- Integration: Postgres + MySQL via testcontainers
- Credential store: round-trip encrypt/decrypt, keychain mock, env var resolution
- CLI e2e: connect to Postgres container, run query, check output formats

---

## v0.2.0 — Connection Pooling, Caching, Introspection Polish (Milestone 2)

**Goal**: Production-ready connection management and snappy repeat introspection.

### 2a. Connection pooling

- `ConnectionManager` wrapping driver-native pools (`pg.Pool`, `mysql2.createPool`)
- Generic pool implementation for drivers without native pooling
- Config per connection: `min`, `max`, `idleTimeoutMs`, `acquireTimeoutMs`, `maxWaitingClients`
- Health checks: validation query before checkout, configurable interval
- Auto-reconnect for stateless operations (not mid-transaction)

### 2b. Caching layer

- `packages/cache/`
- Memory LRU (`lru-cache`) for hot schema metadata
- SQLite disk cache (`~/.maitredb/cache.db`) via `better-sqlite3` (optional, falls back to memory-only)
- Cache key: `{connectionId}:{dialect}:{operation}:{schema}:{object}`
- TTLs: schema metadata 5 min, permissions 2 min, query results off by default
- DDL-triggered invalidation (queries detected in v0.0.1 now actually clear the cache)

### 2c. Full introspection commands

- `mdb schema <conn> functions`
- `mdb schema <conn> procedures`
- `mdb schema <conn> indexes <table>`
- `mdb schema <conn> types`
- `mdb permissions <conn> roles`
- `mdb permissions <conn> grants [--role <role>]`
- `mdb permissions <conn> table-grants <table>`

### 2d. Query history (local)

- `~/.maitredb/history.db` (SQLite) storing `AuditEntry` records
- `mdb history [--connection <name>] [--last 20]`
- Param logging off by default for connections tagged `production`

---

## v0.3.0 — DuckDB, ClickHouse, Streaming Maturity (Milestone 3)

**Goal**: Embedded analytics (DuckDB) and the first columnar-native database (ClickHouse).

### 3a. DuckDB driver

- `packages/driver-duckdb/` using `@duckdb/node-api`
- Embedded — connects to local files, no server
- Arrow-native result path (DuckDB returns Arrow directly — zero parsing)
- This is the first driver using Arrow results natively

### 3b. ClickHouse driver

- `packages/driver-clickhouse/` using `@clickhouse/client`
- Request `ArrowStream` format for zero-parsing results
- Streaming selects and inserts
- `EXPLAIN PIPELINE` for tracing

### 3c. Arrow result model

- Introduce `apache-arrow` as the internal result representation
- `QueryResult` now wraps Arrow `RecordBatch`
- Ergonomic layer: `result.column('name')`, `result.rows()` (Proxy-based lazy row iterator), `result.toObjects()`
- Warning logged if `.toObjects()` called on >10K rows
- Output formatters updated to consume Arrow-backed results
- JS fallback: for drivers still returning `Array<Object>`, convert to Arrow `RecordBatch` in JS

### 3d. Streaming with backpressure in Arrow batches

- `stream()` now yields `RecordBatch` (configurable `batchSize`, default 10,000 rows)
- `--stream` CLI flag for constant-memory streaming output
- Backpressure via `AsyncIterable` + Node.js `highWaterMark`

---

## v0.4.0 — Cloud Warehouses (Milestone 4)

**Goal**: Snowflake, MongoDB, BigQuery, Redshift, Athena — all 11 drivers complete.

### 4a. Snowflake driver

- `packages/driver-snowflake/` using `snowflake-sdk` v2.3
- Key-pair auth (preferred), SSO, token caching
- Arrow result format (supported since 2023)
- Multi-statement support

### 4b. MongoDB driver

- `packages/driver-mongodb/` using `mongodb` v6
- `execute()` accepts `MongoOperation` (structured) or minimal SQL-to-MQL
- BSON → Arrow column builder (document-by-document — inherent to doc model)
- Schema introspection via collection sampling

### 4c. BigQuery driver

- `packages/driver-bigquery/` using `@google-cloud/bigquery` v7
- Async job model: submit → poll → fetch
- Arrow result format via Storage Read API
- Application Default Credentials (ADC) or service account key

### 4d. Redshift driver

- `packages/driver-redshift/` using `@aws-sdk/client-redshift-data` v3
- Async statement execution via Data API
- IAM auth / Secrets Manager
- Optional direct connection via `pg` (reuses Postgres binary path)

### 4e. Athena driver

- `packages/driver-athena/` using `@aws-sdk/client-athena` v3
- Fully async: submit → poll → fetch results from S3
- No connection pooling (stateless)
- Results as Parquet in S3 → read into Arrow via DuckDB

### 4f. Auth method hierarchy

- Per-connection auth preference order: `["key-pair", "token-cache", "oauth-refresh", "browser-sso"]`
- Token caching: store OAuth access/refresh tokens with expiry in credential store
- Silent token refresh (no browser, no user interaction)
- `--as agent` skips interactive auth methods

---

## v0.5.0 — Rust Wire Parser & Performance (Milestone 5)

**Goal**: The performance architecture — Rust hot path, 10-50x faster results.

### 5a. `@maitredb/wire` Rust addon

- `packages/wire/` with napi-rs
- Postgres binary protocol parser → Arrow IPC buffers
- MySQL binary protocol parser → Arrow IPC buffers
- Prebuilt binaries via `prebuild-install`: darwin-arm64, darwin-x64, linux-x64-gnu, linux-arm64-gnu, win32-x64-msvc
- Fallback: graceful degradation to JS parsing when native addon unavailable

### 5b. Prepared statement caching

- Per-connection LRU cache keyed by SQL hash (xxhash)
- Postgres: named prepared statements (server-side, persist for connection lifetime)
- MySQL: `cachePreparedStatements: true` (already set in v0.1.0, now with LRU management)
- Cache size configurable, default 256 per connection

### 5c. Worker thread pool

- `piscina` worker pool for CPU-bound transforms
- Arrow IPC `ArrayBuffer` transfer via `postMessage` (zero-copy)
- Initially used for format conversion; later for masking and compression

### 5d. Performance benchmarks

- Internal benchmark suite comparing stock driver vs. Maître d'B path
- Validate targets: 10-50x parse throughput, 10-20x memory, near-zero GC pauses

---

## v0.6.0 — Governance & Agent Mode (Milestone 6)

**Goal**: Safe agent access with policy enforcement.

### 6a. Governance package

- `packages/governance/`
- Policy file loader: `~/.maitredb/policies.json`
- Query classifier: DDL vs DML, read vs write
- Policy enforcement: allowed schemas, blocked operations, read-only mode, rate limiting, max rows per query
- `GovernanceError` with structured reason + suggestion

### 6b. Agent mode

- `--as agent` flag activates agent policy for the session
- Skips interactive auth (browser SSO, password prompt)
- Enforces governance policy from `connectionPolicies` mapping
- Session timeout (`sessionTimeoutMs`)
- Max concurrent queries enforcement

### 6c. EXPLAIN gating

- `requireExplainBefore.rowEstimateThreshold` — run EXPLAIN before expensive queries
- If estimated rows exceed threshold, return `EXPLAIN_REQUIRED` error with the plan

### 6d. Middleware & hook system

- Pre/post query hooks: `before`, `after`, `error` phases
- Built-in hooks: audit logger, slow query logger, query transformer
- User-defined hooks via config (exec commands on events)

---

## v0.7.0 — Data Masking (Milestone 7)

**Goal**: Client-side masking — agents never see raw PII.

### 7a. Masking engine

- Streaming transform in `packages/governance/`
- Masking strategies: `partial`, `redact`, `hash`, `nullify`, `noise`, `generalize`, `synthetic`, `none`
- Caller-aware: different masking levels for agent vs human vs programmatic
- Column matching by name pattern, tag, or value regex

### 7b. Rust masking hot path

- SHA-256 truncated hashing in `@maitredb/wire`
- Format-preserving partial masking
- Statistical noise injection
- Constant-value replacement (redact)
- Runs on worker threads for large result sets

### 7c. Masking CLI

- `mdb masking scan <conn> --schema public` — auto-detect PII columns
- `mdb masking preview <conn> <table>` — show what masking would do
- `mdb query <conn> "SQL" --mask "email:partial,ssn:redact"` — inline one-off masking

### 7d. Masking policy config

- `.maitredb/masking.json` or `~/.maitredb/masking.json`
- Per-connection rules with column match patterns
- `applyTo` arrays per rule (agent, human, human-readonly, programmatic)
- Consistent hashing with per-connection salt from credential store

---

## v0.8.0 — Faker & Data Bootstrapping (Milestone 8)

**Goal**: Seed dev/test databases with realistic, schema-aware fake data.

### 8a. Faker package

- `packages/faker/` wrapping `@faker-js/faker`
- Schema-aware auto-generation: introspect table → infer generators per column
- Column-to-generator heuristics (name patterns, types, constraints)
- FK dependency resolution: topological sort, seed parents before children
- Respect NOT NULL, UNIQUE, CHECK constraints
- Override file: `.maitredb/faker.json`

### 8b. Faker CLI

- `mdb faker seed <conn> <table> --count 1000`
- `mdb faker seed <conn> --schema public --count 1000` (whole schema)
- `mdb faker preview <conn> <table> --count 5`
- `mdb faker inspect <conn> <table>` (show inferred generators)
- `mdb faker clean <conn> --schema public` (truncate in reverse FK order)
- `mdb faker export <conn> <table> --count 1000 --format sql`
- `--locale`, `--seed` flags

### 8c. Synthetic masking integration

- `synthetic` masking strategy uses `@maitredb/faker` under the hood
- Consistent: same input → same fake output per session

---

## v0.9.0 — Dump, Export & Iceberg (Milestone 9)

**Goal**: Universal dump to open formats — your data leaves proprietary silos.

### 9a. Dump package

- `packages/dump/`
- DuckDB as the in-process write engine for Parquet/Iceberg
- Pipeline: source driver `stream()` → optional masking transform → DuckDB writer → Parquet files + Iceberg metadata

### 9b. Export formats

- `mdb dump <conn> <table> --to iceberg --output ./warehouse/`
- `mdb dump <conn> <table> --to parquet --output ./export.parquet`
- `mdb dump <conn> --schema public --to sql --dialect postgresql`
- `mdb dump <conn> <table> --to csv`

### 9c. Load / restore

- `mdb load <conn> --from iceberg --input ./warehouse/users --create-table`
- Schema translation between dialects (Iceberg/Parquet types → target DB types)

### 9d. Masked dump

- `mdb dump <conn> <table> --to iceberg --mask` — apply masking during export
- `mdb dump <conn> <table> --to iceberg --mask --faker-fill` — mask + fill with synthetic data

### 9e. Inspect

- `mdb inspect ./warehouse/users --format iceberg` — view Iceberg table metadata without a database

---

## v0.10.0 — Optimize & Bench (Milestone 10)

**Goal**: DBA-grade recommendations and rigorous benchmarking.

### 10a. Optimization engine

- `mdb optimize <conn>` — cross-reference schema, query history, EXPLAIN plans, system stats
- Per-database recommendations: missing indexes, unused indexes, bloat, config tuning
- `--focus indexes|queries|storage|config`
- `--format json` for programmatic consumption

### 10b. Benchmarking tool

- `mdb bench <conn> "SQL" --runs 100 --interval 1s`
- Pre-filled templates: `--point-lookup`, `--full-scan`, `--inner-join`, `--aggregate`, `--write-insert`, `--write-update`, `--concurrent`, `--cold-start`
- `--suite standard` runs all read benchmarks
- Percentile output: min, max, mean, median, p95, p99, stddev, histogram
- Comparison mode: `mdb bench <conn1> <conn2> --inner-join --compare`

---

## v0.11.0 — Schema Diff, Transactions, MCP Server (Milestone 11)

**Goal**: Cross-environment comparison, transaction support, and agent tool serving.

### 11a. Schema diffing

- `mdb diff <conn1> <conn2> [--schema public]`
- Report: tables added/removed/modified, column changes, index differences, function signature changes
- Output as table (CLI) or JSON

### 11b. Transaction support

- Inline: `mdb transaction <conn> --begin "stmt1" "stmt2" --commit`
- Interactive: `mdb session <conn>` — persistent REPL with transaction state
- Agent batch: JSON via stdin with `"mode": "transaction"`
- `beginTransaction()`, `commit()`, `rollback()` in `DriverAdapter`

### 11c. MCP server

- `mdb mcp-server` — expose capabilities as MCP tools
- Tools: `query`, `schema`, `connect test`
- Agent governance always applied in MCP mode
- Rich tool descriptions for LLM consumption

---

## v0.12.0 — GUI (Milestone 12)

**Goal**: Tauri 2 desktop app — visual access to everything the CLI can do.

### 12a. Tauri + sidecar architecture

- `apps/gui/` — Tauri 2 + React + Vite + TailwindCSS
- Core runs as Node.js sidecar process, exposes local WebSocket API
- All database logic stays in TypeScript, shared with CLI

### 12b. Core screens

1. **Connection Manager** — add/edit/test/group connections, visual status
2. **Query Editor** — Monaco with dialect-specific syntax highlighting, autocomplete from cached schema, multi-tab
3. **Results Viewer** — TanStack Table data grid, virtual scrolling, column sorting/filtering, export
4. **Schema Explorer** — tree sidebar: Connection > Schema > Tables/Views/Functions

### 12c. Advanced screens

5. **Trace Profiler** — visual query plan DAG via React Flow
6. **Permissions Viewer** — role hierarchy + grant matrix
7. **Diff View** — side-by-side schema comparison
8. **Audit Log Viewer** — searchable query history
9. **Masking Policy Editor** — visual rule builder
10. **Faker UI** — generate/preview fake data
11. **Dump/Load UI** — visual export/import
12. **Optimization Report** — recommendation cards with SQL suggestions
13. **Benchmark Results** — histogram + percentile display

---

## v1.0.0 — GA (Milestone 13)

**Goal**: Production-ready, polished, documented.

### 13a. Remaining features

- SSH tunnel support (`ssh2` package)
- Team workspace support (project-level `.maitredb/`)
- Incremental dumps (only changed data)
- Cross-database copy: `mdb copy <src>.<table> → <tgt>.<table> [--mask]`
- Cloud storage targets: S3, GCS, Azure Blob (via DuckDB httpfs/s3 extensions)
- `mdb cache clear`, `mdb cache stats`

### 13b. npx / zero-install polish

- Verify cold-start under 2 seconds for `npx maitredb query`
- `--config-inline` flag for zero-filesystem agent invocations
- All native deps as optional with clear fallback messages

### 13c. Quality & release

- Accessibility audit for GUI
- CI/CD release pipeline (GitHub Actions → npm publish, Tauri build/sign/notarize)
- Documentation site
- Plugin API stabilized and documented for third-party drivers

---

## Dependency Graph (What Blocks What)

```
v0.0.1 Skeleton ─┬─▶ v0.1.0 PG/MySQL/Creds ──▶ v0.2.0 Pooling/Cache
                  │
                  └─▶ v0.3.0 DuckDB/CH/Arrow ──▶ v0.5.0 Rust Wire
                                                     │
v0.1.0 ─────────────▶ v0.4.0 Cloud Warehouses       │
                                                     ▼
v0.2.0 + v0.4.0 ───▶ v0.6.0 Governance ──▶ v0.7.0 Masking ──▶ v0.8.0 Faker
                                                     │
v0.3.0 (DuckDB) ──────────────────────────▶ v0.9.0 Dump/Iceberg
                                                     │
v0.2.0 (history) ──▶ v0.10.0 Optimize/Bench         │
                                                     ▼
v0.6.0 ────────────▶ v0.11.0 Diff/Tx/MCP           │
                                                     │
Everything ─────────▶ v0.12.0 GUI ──▶ v1.0.0 GA ◀──┘
```

## Parallelizable Work

Some milestones can overlap if multiple contributors are available:

| Can run in parallel | Because |
|---|---|
| v0.3.0 (DuckDB/CH/Arrow) + v0.1.0 (PG/MySQL/Creds) | Different drivers, no shared dependency |
| v0.4.0 (Cloud warehouses) + v0.2.0 (Pooling/Cache) | Driver work vs infrastructure work |
| v0.5.0 (Rust wire) + v0.6.0 (Governance) | Native addon vs JS policy engine |
| v0.8.0 (Faker) + v0.9.0 (Dump) | Independent packages, both depend on masking |
| v0.10.0 (Optimize/Bench) alongside v0.7.0–v0.9.0 | Mostly independent of masking/faker/dump |

## Principles

1. **Every milestone produces a usable tool.** v0.0.1 can query SQLite. v0.1.0 can query Postgres with real credentials. No milestone is "infrastructure only."
2. **Plain JS first, optimize later.** Arrow result model in v0.3.0, Rust parser in v0.5.0. The JS fallback path is always maintained.
3. **Security is early, governance is mid.** Credential encryption (v0.1.0) before cloud warehouses (v0.4.0). Governance (v0.6.0) before masking (v0.7.0). Neither is day-1 because they need a working query path to enforce against.
4. **GUI is last.** Every GUI feature maps to a CLI/core feature that already works. The GUI never drives architecture — it consumes it.
5. **Test infrastructure scales with the code.** Unit tests from v0.0.1, testcontainers from v0.1.0, CLI e2e from v0.0.1. No "add tests later" phase.
