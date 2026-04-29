# Maître d'B — Change Log

> Chronological record of all changes, improvements, and fixes.
> Follows [Keep a Changelog](https://keepachangelog.com/) format.

## [v0.6.0] — 2026-04-29

### Added

- **Governance package — `@maitredb/governance` (Agent Safety workstream)**
  - New package `@maitredb/governance@0.6.0` with policy and safety primitives for agent-mode query execution
  - `QueryClassifier` parses SQL into normalized statements and classifies operation metadata (`read`, `write`, `ddl`, `dcl`, `transaction`) plus risk patterns
  - `PolicyEngine` evaluates agent-mode requests against allow/block rules (operation classes, schema/table patterns, approval requirements, and limits)
  - `ApprovalManager` issues and validates short-lived, one-time approval tokens tied to connection/query hash/agent identity
  - `AuditLogger` persists governance decisions to SQLite (`better-sqlite3`) using append-only controls for immutable decision history
  - `HookRegistry` enables pre/post policy hooks for extension points and custom controls

- **CLI agent-mode governance integration**
  - `mdb query` now supports governance flags for agent operation: `--as agent`, `--policy`, `--agent-id`, `--dry-run`, `--approval-token`
  - Agent-mode runs policy evaluation before execution and blocks unsafe operations with typed governance errors
  - Dry-run mode can return approval-needed outcomes without executing SQL, including tokenized approval flow support
  - Governance decisions (allowed/blocked/approval-required) are audited with connection, agent, operation class, and rationale metadata

### Changed

- **Governance error model alignment in core**
  - Added `APPROVAL_REQUIRED (3007)` and `APPROVAL_EXPIRED (3008)` to `@maitredb/core` error taxonomy to support approval-gated execution flows

### Tests

- `packages/governance/src/__tests__/classifier.test.ts`: statement splitting, comment/literal handling, operation/risk classification
- `packages/governance/src/__tests__/policy-engine.test.ts`: allow/block decisions, approval-required paths, policy validation behavior
- `packages/governance/src/__tests__/approval-manager.test.ts`: token issue/validate/consume semantics, expiry, one-time usage constraints
- `packages/governance/src/__tests__/audit-logger.test.ts`: SQLite audit persistence, append-only behavior, decision-querying
- `apps/cli/src/__tests__/cli-e2e.test.ts`: end-to-end governance path covering blocked DDL, approval-required updates, dry-run token issuance, approved execution, and audit assertions

### Verification

- `pnpm --filter @maitredb/governance build`
- `pnpm --filter @maitredb/governance test`
- `pnpm --filter @maitredb/cli build`
- `pnpm --filter @maitredb/cli test`
- Workspace validation: `pnpm test` completed successfully (`36/36` tasks)

---

## [v0.5.0] — 2026-04-29

### Added

- **Wire package foundations — `@maitredb/wire`**
  - Introduced `@maitredb/wire@0.5.0` package with TypeScript-first parser path and Rust napi-rs scaffold for Arrow-focused wire parsing evolution
  - Added JS fallback parser and package structure to allow zero-install operation when native artifacts are unavailable
  - Added optional native binding loading strategy by platform with graceful fallback behavior

- **Prepared statement performance layer in core**
  - Added prepared statement cache to `@maitredb/core` with bounded retention and reuse mechanics for repeat query plans
  - Added worker-pool integration with in-process fallback path to keep execution resilient across environments
  - Extended execution paths to reuse prepared handles where supported, reducing repeated prepare/parse overhead

- **Driver prepared-statement integration**
  - PostgreSQL and MySQL drivers updated to participate in prepared caching flows through core integration points
  - Driver paths preserve streaming semantics while enabling cache-aware execution strategy

### Changed

- **Repository hygiene for wire native artifacts**
  - Added `target/` to `.gitignore` to prevent Rust build artifacts from polluting workspace diffs
  - Removed local `packages/wire/target` artifact directory from tracked change set

### Tests

- Added/expanded test coverage across `@maitredb/wire`, `@maitredb/core`, driver integrations, and CLI behavior for prepared/cache execution paths
- Validation included package-level and workspace-level test runs to ensure no regressions in streaming behavior, type safety, and command execution

### Verification

- Workspace validation: `pnpm test` completed successfully (`36/36` tasks)

## [v0.4.0] — 2026-04-28

### Added

- **Snowflake driver — `@maitredb/driver-snowflake` (Workstream 4a)**
  - New package `@maitredb/driver-snowflake@0.4.0` using `snowflake-sdk ^2.3.0`
  - `connect()` iterates `config.auth` array in priority order: key-pair (`SNOWFLAKE_JWT` + `privateKey`/`privateKeyPath`) → token-cache/oauth-refresh (`OAUTH` + `token`) → password fallback; all snowflake-sdk callbacks are promisified via internal helpers
  - `execute()` calls `promiseExecute()`, returns `batch` (Arrow `RecordBatch`) for SELECTs, plain `rowCount` for writes; `stream()` uses `streamResult: true` and `Statement.streamRows()` for native row streaming
  - `beginTransaction()` issues `BEGIN`/`COMMIT`/`ROLLBACK` via `promiseExecute()`
  - Full introspection: `getSchemas()` via `SHOW SCHEMAS`; `getTables()` via `SHOW TABLES` + `SHOW VIEWS`; `getColumns()` via `INFORMATION_SCHEMA.COLUMNS`; `getIndexes()` via `SHOW PRIMARY KEYS IN TABLE`; `getRoles()` via `SHOW ROLES`; `getGrants()` via `SHOW GRANTS TO ROLE`
  - `sanitizeIdentifier()` wraps identifiers in double-quotes and escapes embedded quotes
  - `capabilities()`: `transactions: true`, `streaming: true`, `explain: true`, `roles: true`, `schemas: true`, `costEstimate: true`, `arrowNative: false`

- **Auth method hierarchy (Workstream 4f)**
  - Snowflake `connect()` supports an ordered `config.auth` array — the driver iterates it in declaration order and selects the first matching method: key-pair JWT → OAUTH token → password; enables seamless credential rotation without code changes

- **MongoDB driver — `@maitredb/driver-mongodb` (Workstream 4b)**
  - New package `@maitredb/driver-mongodb@0.4.0` using `mongodb ^6.0.0`
  - `execute()` accepts MongoOperation JSON objects (`{ collection, op, args?, projection?, sort?, limit? }`) or a minimal SQL SELECT statement parsed via `parseSqlToMongoOp()` regex parser
  - Supported ops: `find`, `aggregate`, `insertOne`, `insertMany`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `command`
  - `stream()` uses async iterator over native cursor for `find`/`aggregate` operations
  - `beginTransaction()` uses `client.startSession()` + `session.startTransaction()` with commit/rollback
  - Introspection: `getSchemas()` via `admin.command({ listDatabases: 1 })`; `getTables()` via `db.listCollections()`; `getColumns()` samples 100 documents and infers field types; `_id` field marked `isPrimaryKey: true`
  - BSON types stripped via `JSON.parse(JSON.stringify(doc))` to avoid ObjectId serialization issues
  - `capabilities()`: `transactions: true`, `streaming: true`, `explain: true`, `roles: true`, `schemas: true`, `arrowNative: false`

- **BigQuery driver — `@maitredb/driver-bigquery` (Workstream 4c)**
  - New package `@maitredb/driver-bigquery@0.4.0` using `@google-cloud/bigquery ^7.0.0`
  - Async job model: `execute()` creates a query job → polls `job.getMetadata()` until `status.state === 'DONE'` → fetches with `job.getQueryResults({ autoPaginate: true })`; DDL returns `rowCount: 0`
  - `stream()` uses `bq.createQueryStream()` async iterator for constant-memory streaming
  - `explain()` leverages BigQuery dry-run (`dryRun: !options?.analyze`) for cost estimation without execution; real `EXPLAIN` plan returned when `analyze: true`
  - Introspection: `getTables()` via `bq.dataset(datasetId).getTables()`; `getColumns()` via `dataset.table(table).getMetadata()` with BigQuery schema field mapping
  - `capabilities()`: `transactions: false`, `asyncExecution: true`, `costEstimate: true`, `arrowNative: false`

- **Redshift driver — `@maitredb/driver-redshift` (Workstream 4d)**
  - New package `@maitredb/driver-redshift@0.4.0` using `@aws-sdk/client-redshift-data ^3.0.0` (stateless Data API, no JDBC)
  - `execute()` sends `ExecuteStatementCommand`, polls `DescribeStatementCommand` until `FINISHED`/`FAILED`/`ABORTED`; supports both `ClusterIdentifier` (provisioned) and `WorkgroupName` (serverless), plus `DbUser` and `SecretArn`
  - `fetchAllResults()` pages `GetStatementResultCommand`; parses Data API field union: `isNull` → null, `stringValue`, `longValue`, `doubleValue`, `booleanValue`
  - `cancelQuery()` sends `CancelStatementCommand`
  - Introspection: `getSchemas()` via `ListSchemasCommand`; `getTables()` via `ListTablesCommand`; `getColumns()` via `DescribeTableCommand`; `getIndexes()` via SQL fallback querying `pg_indexes`
  - `capabilities()`: `transactions: false` (Data API limitation), `asyncExecution: true`, `cancelQuery: true`, `roles: true`

- **Athena driver — `@maitredb/driver-athena` (Workstream 4e)**
  - New package `@maitredb/driver-athena@0.4.0` using `@aws-sdk/client-athena ^3.0.0` (fully stateless, no TCP connection held)
  - `connect()` requires `options.outputLocation` (S3 URI); creates `AthenaClient` with `region` from config or `AWS_REGION` environment variable
  - `startAndWaitQuery()` sends `StartQueryExecutionCommand` with `QueryExecutionContext`, `ResultConfiguration.OutputLocation`, optional `WorkGroup` and `ResultReuseConfiguration`; polls `GetQueryExecutionCommand` checking `Status.State`; throws on `FAILED`/`CANCELLED`
  - `fetchAllResults()` pages `GetQueryResultsCommand`; skips the header row in the first page by comparing values to column metadata names
  - `cancelQuery()` sends `StopQueryExecutionCommand`
  - `beginTransaction()` throws — Athena is stateless and does not support transactions
  - Introspection: `getSchemas()` via `ListDatabasesCommand`; `getTables()` via `ListTableMetadataCommand` (with VIEW detection); `getColumns()` via `GetTableMetadataCommand`; `getIndexes()` returns empty (Athena/Presto has no traditional indexes)
  - `explain()` runs `EXPLAIN <sql>` via Athena/Presto engine
  - `capabilities()`: `transactions: false`, `asyncExecution: true`, `cancelQuery: true`, `schemas: true`, `arrowNative: false`

- **CLI driver registration**
  - All 5 new drivers registered lazily in `apps/cli/src/bootstrap.ts` via `getRegistry().registerFactory()` using runtime-dynamic imports so CLI type-checks do not require prebuilt `dist/index.d.ts` artifacts
  - `apps/cli/package.json` now depends on all 11 driver packages (`workspace:*`)

### Fixed

- Tightened v0.4.0 integration against strict TypeScript by correcting AWS SDK command input typing, BigQuery constructor option typing, MongoDB write concern typing, Snowflake stream typing, and CLI lazy import module resolution
- Corrected MongoDB `ObjectId` type inference so `objectid` maps to `unknown` rather than being caught by the broader `object` check
- BigQuery execution now merges connection `config.options` overrides with stored native options, preserving per-connection query controls such as `maximumBytesBilled`

### Tests

- `packages/driver-snowflake/src/__tests__/snowflake-driver.test.ts` (23 tests, fully mocked): auth method selection (key-pair, OAUTH token, password fallback); connect failure; lifecycle; `execute()` SELECT / INSERT / DDL; `stream()` via Snowflake streaming API; `beginTransaction()` commit/rollback; `getSchemas`/`getTables`/`getColumns`/`getIndexes`/`getRoles`/`explain`; `mapNativeType()` coverage
- `packages/driver-mongodb/src/__tests__/mongodb-driver.test.ts` (23 tests, fully mocked): `connect()`/`disconnect()`; `execute()` with JSON op (find, insertOne, deleteOne); SQL SELECT parse path; `stream()` cursor iteration; `beginTransaction()` commit/rollback; `getSchemas`/`getTables`/`getColumns`; `explain()`; `mapNativeType()` coverage
- `packages/driver-bigquery/src/__tests__/bigquery-driver.test.ts` (21 tests, fully mocked): job poll loop; `execute()` SELECT/DDL; `stream()`; `explain()` dry-run vs analyze; `getTables`/`getColumns`; `mapNativeType()` coverage; `capabilities()` flags
- `packages/driver-redshift/src/__tests__/redshift-driver.test.ts` (16 tests, fully mocked): Data API polling; field union type parsing; `cancelQuery()`; `getSchemas`/`getTables`/`getColumns`/`getIndexes`; `mapNativeType()` coverage
- `packages/driver-athena/src/__tests__/athena-driver.test.ts` (19 tests, fully mocked): connect without `outputLocation` throws; `AthenaClient` region; `disconnect()` destroys client; polling `SUCCEEDED`/`FAILED`/`CANCELLED`; `NextToken` pagination; `stream()`; `cancelQuery()`; `beginTransaction()` throws; `getSchemas`/`getTables`/`getColumns`/`getIndexes`; `explain()`; `mapNativeType()` full Presto type coverage

---

## [v0.3.0] — 2026-04-14

### Added

- **Arrow type foundations (Phase 0)**
  - `apache-arrow ^18.0.0` added as dependency to `@maitredb/plugin-api` and `@maitredb/core`
  - `StreamOptions` interface (`batchSize?: number`) added to `@maitredb/plugin-api`
  - `QueryResult.batch?: RecordBatch` optional field — present for Arrow-native drivers and attached by the executor for JS-object drivers after conversion; `rows` is empty when `batch` is set
  - `DriverCapabilities.arrowNative: boolean` — declares whether `streamBatches()` returns `RecordBatch` without JS-side conversion
  - `streamBatches?()` optional method added to `DriverAdapter` contract — Arrow-native drivers implement it; the `QueryExecutor` prefers it over `stream()` when present

- **Arrow utilities and executor updates — `@maitredb/core` (Phase 1)**
  - `packages/core/src/arrow-utils.ts`: `rowsToRecordBatch(rows, fields)` converts JS object arrays to Arrow `RecordBatch` via `tableFromArrays`; `recordBatchToRows(batch)` materialises a batch to plain JS objects; `batchRows(source, fields, batchSize)` async generator buffers a row-stream into `RecordBatch` chunks; `maitreTypeToArrow(type)` maps `MaitreType` to Arrow `DataType`
  - `packages/core/src/arrow-result.ts`: `ArrowResult` ergonomic wrapper — `column(name)` O(1) vector access; `rows()` Proxy-based lazy iterator that reads from column buffers without per-row allocation; `toObjects()` materialises all rows with a stderr warning above 10 000 rows
  - `QueryExecutor.execute()` attaches an Arrow `RecordBatch` to results from non-Arrow drivers (best-effort; failures leave `batch` undefined)
  - `QueryExecutor.stream()` now yields `AsyncIterable<RecordBatch>` — uses `streamBatches()` for Arrow-native drivers, wraps `stream()` + `batchRows()` for others; `batchSize` option added to `ExecutorOptions`
  - `packages/core/src/formatters.ts` gains a `getRows()` helper that falls back to `recordBatchToRows(batch)` when `rows` is empty — all formatters transparently handle Arrow-native results
  - `ArrowResult`, `rowsToRecordBatch`, `recordBatchToRows`, `batchRows` exported from `@maitredb/core` barrel
  - Existing drivers (`driver-sqlite`, `driver-postgres`, `driver-mysql`, `driver-template`) gain `arrowNative: false` in `capabilities()`

- **DuckDB driver — `@maitredb/driver-duckdb` (Workstream 3a)**
  - New package `@maitredb/driver-duckdb@0.3.0` using `@duckdb/node-api`
  - `execute()` SELECT path calls `runAndReadAll()` + `getRowObjectsJS()` then converts to Arrow batch; `rows` is always empty on success; writes (INSERT/UPDATE/DDL) use `conn.run()`
  - `streamBatches()` uses DuckDB's native `conn.stream()` + `yieldRowObjectJs()` to chunk results into `RecordBatch`s of configurable `batchSize`; `stream()` compatibility shim iterates the batch column-by-column
  - Full introspection: `getSchemas()` via `information_schema.schemata`; `getTables()` via `information_schema.tables`; `getColumns()` via `information_schema.columns`; `getIndexes()` via `duckdb_indexes()`; `getFunctions()` via `duckdb_functions()`; `getTypes()` via `duckdb_types()` returning `labels` column for enum values (not Arrow-converted to avoid list-column round-trip issues); `getProcedures()`/`getRoles()`/`getGrants()` return empty
  - `beginTransaction()` runs `BEGIN`/`COMMIT`/`ROLLBACK`; `cancelQuery()` throws (DuckDB embedded has no cancellation)
  - `explain()` with `EXPLAIN` / `EXPLAIN ANALYZE`
  - Type mapping for all DuckDB types including `HUGEINT`, `INTERVAL`, composite types
  - `capabilities()`: `arrowNative: true`, `embedded: true`, `transactions: true`, `costEstimate: true`
  - Registered as `'duckdb'` in CLI `bootstrap.ts`; DSN parser handles `duckdb://` and `duckdb://:memory:`
  - CLI `package.json` depends on `@maitredb/driver-duckdb: workspace:*`

- **ClickHouse driver — `@maitredb/driver-clickhouse` (Workstream 3b)**
  - New package `@maitredb/driver-clickhouse@0.3.0` using `@clickhouse/client`
  - `connect()` uses `client.ping()` for validation; supports HTTP/HTTPS based on `config.ssl`
  - `execute()` tries Arrow IPC format (`format: 'Arrow'`) first, falls back to JSONEachRow on failure; Arrow path parses IPC bytes via `tableFromIPC`; JSONEachRow path returns `rows` populated (no batch); DDL/write path uses `client.command()`
  - `streamBatches()` tries `format: 'ArrowStream'` first and parses chunked IPC; falls back to `execute()` + batch conversion when ArrowStream unavailable
  - `cancelQuery()` runs `KILL QUERY WHERE query_id = '...'`; `beginTransaction()` throws `TRANSACTION_NOT_SUPPORTED`
  - Introspection: `getSchemas()` via `system.databases`; `getTables()` via `system.tables` with VIEW detection; `getColumns()` via `system.columns` with `is_in_primary_key` mapping; `getFunctions()` via `system.functions`; `getRoles()` via `system.roles`; `getGrants()` via `system.grants`; `getTypes()`/`getProcedures()`/`getIndexes()` return empty (ClickHouse uses built-in types / sort keys)
  - Type mapping strips `Nullable(T)` and `LowCardinality(T)` wrappers before matching
  - `capabilities()`: `arrowNative: true`, `roles: true`, `cancelQuery: true`, `transactions: false`, `embedded: false`
  - Registered as `'clickhouse'` in CLI `bootstrap.ts`; DSN parser handles `clickhouse://`
  - CLI `package.json` depends on `@maitredb/driver-clickhouse: workspace:*`

- **Streaming maturity — `mdb query` (Workstream 3d)**
  - `mdb query <conn> <sql> --stream` flag streams output with constant memory — one `RecordBatch` at a time via `executor.stream()`
  - `--batch-size <n>` (default 10 000) controls rows per Arrow batch in streaming mode
  - `--stream --format table` degrades to `ndjson` with a stderr warning (table format requires all rows)
  - Streaming path shares the same `finally` block as `execute()` for connection release and resource cleanup

### Tests

- `packages/driver-duckdb/src/__tests__/duckdb-driver.test.ts` (18 tests): connect/disconnect lifecycle, SELECT returns `batch` with data and empty `rows`, DDL returns `rowCount: 0`, `streamBatches()` yields `RecordBatch`s with correct row counts and respects `batchSize`, `stream()` compat yields plain JS objects, transaction commit/rollback round-trips, `getSchemas`/`getTables`/`getColumns`/`getTypes` (ENUM labels), `mapNativeType` spot-checks across all categories, `capabilities()` flags, `explain()` non-empty plan
- `packages/driver-clickhouse/src/__tests__/clickhouse-driver.test.ts` (20 tests, fully mocked — no real server): `connect()` URL/credentials, ping failure throws, `disconnect()` calls `close()`, `validateConnection()` true/false, DDL calls `command()` not `query()`, SELECT falls back to JSONEachRow when Arrow unavailable, `streamBatches()` falls back to `execute()` when ArrowStream fails, `cancelQuery()` sends `KILL QUERY`, `beginTransaction()` throws, `getSchemas`/`getTables`/`getColumns`/`getRoles` mapping, `mapNativeType` covers all categories + `Nullable()` + `LowCardinality()` unwrapping, `capabilities()` flags

---

## [v0.2.0] — 2026-04-13

### Added

- **Connection pooling (Workstream 2a)**
  - `GenericPool<T>` in `@maitredb/core`: idle queue, active counter, wait queue with configurable `acquireTimeoutMs` and `maxWaitingClients`; idle timer destroys connections past `idleTimeoutMs`; maintains `min` idle connections; throws `POOL_EXHAUSTED` (1007) when queue is full
  - `ConnectionManager` in `@maitredb/core`: pool-aware connection lifecycle manager; resolves config + credentials via `ConfigManager`; delegates to native pools for PostgreSQL/MySQL; uses `GenericPool` for drivers without native pooling; health-checks via `validateConnection()` on acquire with auto-reconnect for non-transactional connections
  - `PoolConfig` type (`min`, `max`, `idleTimeoutMs`, `acquireTimeoutMs`, `maxWaitingClients`) added to `@maitredb/plugin-api`; wired into `ConnectionConfig` as `pool?`
  - PostgreSQL `toPoolConfig()` reads `config.pool.*` → native `pg.Pool` options (`min`, `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`)
  - MySQL `toPoolOptions()` reads `config.pool.*` → native pool options (`connectionLimit`, `acquireTimeout`, `queueLimit`)
  - CLI `bootstrap.ts` exposes `getConnectionManager()` singleton; `query`, `schema`, and `permissions` commands use `ConnectionManager` instead of manual `connect/disconnect`

- **Caching layer — `@maitredb/cache` package (Workstream 2b)**
  - `MemoryCache`: LRU wrapper around `lru-cache` v10+ with per-entry TTL, `invalidate(pattern: RegExp)`, and hit/miss stats
  - `DiskCache`: SQLite-backed persistent cache via optional `better-sqlite3`; graceful no-op fallback when unavailable; lazy expiry cleanup; `cache(key, value, expires_at, created_at)` schema
  - `CacheManager`: memory-first reads with disk promotion; 5-minute TTL for schema results, 2-minute TTL for permission results; `invalidateForConnection(connectionId, dialect, scope)` for targeted invalidation
  - `CachedAdapter`: transparent proxy wrapping any `DriverAdapter`; intercepts all introspection methods (`getTables`, `getColumns`, `getIndexes`, `getFunctions`, `getProcedures`, `getTypes`, `getRoles`, `getGrants`); cache-check before inner call, cache-write on miss; all non-introspection methods (`execute`, `stream`, `connect`, etc.) pass through unchanged
  - `buildCacheKey()` / `invalidationPattern()` utilities for consistent key formatting and pattern-based invalidation
  - `QueryExecutor` DDL detection now calls `cache.invalidateForConnection()` with `'schema'` scope on DDL statements and `'permissions'` scope on GRANT/REVOKE
  - CLI `bootstrap.ts` exposes `getCacheManager()` singleton; `ConnectionManager` wraps adapters in `CachedAdapter` when cache is enabled

- **Full introspection commands (Workstream 2c)**
  - `TypeInfo` type added to `@maitredb/plugin-api`; `getTypes(conn, schema?)` added to `DriverAdapter`; `userDefinedTypes` capability flag added to `DriverCapabilities`
  - PostgreSQL `getTypes()` queries `pg_type` + `pg_namespace` + `pg_enum` for enums, composites, domains, and ranges; `userDefinedTypes: true`
  - MySQL and SQLite `getTypes()` return empty arrays; `userDefinedTypes: false`
  - `mdb schema <conn> functions` — calls `adapter.getFunctions()`, outputs name/returnType/arguments/language
  - `mdb schema <conn> procedures` — calls `adapter.getProcedures()`, outputs name/arguments/language
  - `mdb schema <conn> types` — calls `adapter.getTypes()`, outputs name/type/values/definition
  - New `mdb permissions <conn> <action> [object]` command (`roles`, `grants`, `table-grants`); checks `capabilities().roles` before calling — exits with a clear message for unsupported drivers (e.g. SQLite)

- **Query history (Workstream 2d)**
  - `HistoryStore` in `@maitredb/core`: optional `better-sqlite3` backing with graceful no-op fallback; `history` table with indexes on `connection` and `timestamp`; `record()`, `query({ connection?, last?, since? })`, `maybeRotate(maxSizeMb)` (deletes oldest 20% when file exceeds limit)
  - `QueryExecutor.execute()` records every execution to `HistoryStore` — success and error paths — including duration, rows affected/returned, error code/message; connections tagged `'production'` suppress params from history
  - `mdb history [--connection <name>] [--last N] [--format <format>]` CLI command; displays timestamp, connection, dialect, query (truncated), duration, row count
  - CLI `bootstrap.ts` exposes `getHistoryStore()` singleton
  - History DB defaults to `~/.maitredb/history.db`

- **Shared types in `@maitredb/core`**
  - New `packages/core/src/types.ts`: `AuditEntry`, `CacheOptions`, `HistoryOptions`
  - `MaitreConfig` extended with `cache?: CacheOptions` and `history?: HistoryOptions`
  - `ConnectionConfig` extended with `tags?: string[]` (used for production param suppression)

### Tests

- `packages/core/src/__tests__/generic-pool.test.ts`: max limit enforcement, queue timeout, idle cleanup, validation failure discard, drain, min idle maintenance
- `packages/core/src/__tests__/connection-manager.test.ts`: acquire/release/close lifecycle, health check on acquire, auto-reconnect, `POOL_EXHAUSTED` error
- `packages/cache/src/__tests__/cache-key.test.ts`: key format, invalidation pattern matching
- `packages/cache/src/__tests__/memory-cache.test.ts`: set/get, TTL expiration, pattern invalidation, stats
- `packages/cache/src/__tests__/disk-cache.test.ts`: round-trip on temp file, graceful fallback without `better-sqlite3`
- `packages/cache/src/__tests__/cache-manager.test.ts`: memory-then-disk promotion, DDL invalidation scope, TTL differentiation
- `packages/cache/src/__tests__/cached-adapter.test.ts`: cache hit/miss on introspection, passthrough for execute/stream, DDL invalidation trigger
- `packages/core/src/__tests__/history.test.ts`: record/query round-trip, filter by connection, limit, param suppression for production tags, graceful no-op without `better-sqlite3`, rotation
- CLI e2e: `mdb schema <conn> functions/procedures/types`, `mdb permissions <conn> roles`, `mdb query` → `mdb history --last 1`

---

## [v0.1.0e] — 2026-04-08

### Changed

- **Expanded PostgreSQL driver test suite**
  - Comprehensive unit tests covering `connect()`, `disconnect()`, `testConnection()`, `validateConnection()`, `execute()`, `stream()`, `cancelQuery()`, transaction helpers, and all introspection methods
  - Tests cover error paths: connection failure, query error, cancelled queries, unsupported operations

- **Driver template test suite**
  - Added `packages/driver-template/src/__tests__/driver-template.test.ts` verifying stub implementations compile and return expected shapes

---

## [v0.1.0d] — 2026-04-07

### Added

- **MySQL/MariaDB driver**
  - `packages/driver-mysql/` implements the complete `DriverAdapter` lifecycle: `connect()`, `disconnect()`, `testConnection()`, `validateConnection()`, streaming `execute()/stream()`, `cancelQuery()`, and transaction helpers
  - `getSchemas()/getTables()/getColumns()/getIndexes()` plus `getFunctions()/getProcedures()/getRoles()/getGrants()` for catalog + permission introspection
  - `explain()` parses optimizer output and surfaces warnings; capabilities expose `userDefinedTypes: false`, `roles: true`, `streaming: true`
  - Supports `connectionLimit`, `acquireTimeout`, and `queueLimit` pool options

- **MkDocs documentation site**
  - Added `docs/index.md` and wired TypeDoc-generated Markdown output into a MkDocs pipeline (`pnpm docs:reference`)

### Changed

- **`connect` command refactor**
  - Extracted `connection-config.ts` (connection resolution, DSN merging, credential hydration) and `dsn.ts` (DSN parsing utilities) from `commands/connect.ts` into standalone modules — each independently testable
  - `bootstrap.ts` gains `getRegistry()` helper used by all commands
  - New test suites: `dsn.test.ts` (5 cases), `connection-config.test.ts` (2 cases)

---

## [v0.1.0b] — 2026-04-08

### Added

- **PostgreSQL driver with full feature support (Phase 1b)**
  - `packages/driver-postgres/` implements the complete `DriverAdapter` lifecycle: `connect()`, `disconnect()`, `testConnection()`, `validateConnection()`, streaming `execute()/stream()`, `cancelQuery()`, and transaction helpers.
  - `getSchemas()/getTables()/getColumns()/getIndexes()` plus `getFunctions()/getProcedures()/getRoles()/getGrants()` cover catalog + permission introspection; `explain()` parses JSON output, normalizes plans, and surfaces warnings.
  - Driver capabilities expose streaming, transactions, cancellation, and listen/notify support to the CLI/GUI.

- **Driver authoring template**
  - Added `@maitredb/driver-template` with `TODO(driver)` guidance, helper hooks, and a `DRIVER_BOOTSTRAP_CHECKLIST` tied to the architecture spec so planned/community drivers share a common baseline.
  - Template ships with tsconfig, vitest config, and README instructions for quick duplication.

- **Auto-generated API reference**
  - Integrated TypeDoc + `typedoc-plugin-markdown` and added `pnpm docs:reference`; docs land in `docs/reference/` for Read the Docs/MkDocs pipelines.
  - Annotated CLI commands, ConfigManager, QueryExecutor, formatters, PluginRegistry, DSN parser, and driver classes with TSDoc so the generated docs stay current.

### Changed

- **Driver adapter contract alignment**
  - `DriverAdapter` now includes `validateConnection()` and `cancelQuery()`; `@maitredb/driver-sqlite` implements the new hooks.
  - Repo-wide TS path aliases (`@maitredb/*`) and an ES module vitest workspace (`vitest.workspace.mts`) unblock TypeDoc/TypeScript tooling.

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
