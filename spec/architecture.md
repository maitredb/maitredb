# Maître d'B — Architecture Plan

> *The front-of-house manager for your databases.*
>
> A cross-platform, open-source database client with native CLI and GUI — built
> for humans and agents alike. Handles pooling, query sequencing, credential
> isolation, guardrails, and schema introspection as middleware between your "customers"
> (humans, AI agents, scripts) and the "kitchen" (your databases).

**Package name**: `maitredb` | **CLI command**: `mdb` | **Org scope**: `@maitredb/*`

---

## Table of Contents

1. [Core Decisions](#core-decisions)
2. [File Over App](#file-over-app)
3. [The Metaphor, Applied](#the-metaphor-applied)
4. [Monorepo Structure](#monorepo-structure)
5. [Zero-Install & npx/bunx Access](#zero-install--npxbunx-access)
6. [Credential Isolation & Secret Management](#credential-isolation--secret-management)
7. [Driver Adapter Interface](#driver-adapter-interface)
8. [Database Drivers](#database-drivers)
9. [Streaming-First Architecture](#streaming-first-architecture)
10. [Performance Architecture](#performance-architecture)
11. [Connection Lifecycle & Health](#connection-lifecycle--health)
12. [Caching Strategy](#caching-strategy)
13. [Query Tracing & Profiling](#query-tracing--profiling)
14. [Native Optimization Recommendations](#native-optimization-recommendations)
15. [Database Benchmarking](#database-benchmarking)
16. [Agent Governance & Security Model](#agent-governance--security-model)
17. [Error Taxonomy](#error-taxonomy)
18. [Configuration Hierarchy](#configuration-hierarchy)
19. [Transaction Model](#transaction-model)
20. [Timezone & Type Handling](#timezone--type-handling)
21. [Middleware & Hook System](#middleware--hook-system)
22. [CLI Command Surface](#cli-command-surface)
23. [Programmatic API](#programmatic-api)
24. [GUI (Tauri 2 + React)](#gui-tauri-2--react)
25. [Plugin System](#plugin-system)
26. [Schema Diffing](#schema-diffing)
27. [Query History & Audit Log](#query-history--audit-log)
28. [Multi-Workspace & Team Support](#multi-workspace--team-support)
29. [Client-Side Data Masking](#client-side-data-masking)
30. [Data Bootstrapping (Faker)](#data-bootstrapping-faker)
31. [Universal Dump & Iceberg Export](#universal-dump--iceberg-export)
32. [Testing Strategy](#testing-strategy)
33. [Phased Delivery](#phased-delivery)
34. [Key Dependencies](#key-dependencies)
35. [Appendix: Future Considerations](#appendix-future-considerations)

---

## Core Decisions

| Decision | Choice | Why |
|---|---|---|
| Drivers | **Native Node.js** (not JDBC) | No JVM dependency, 7/7 DBs have mature native drivers |
| GUI | **Tauri 2.x** (not Electron) | 25x smaller bundles, 60-75% less RAM |
| Monorepo | **pnpm + Turborepo** | Best TS monorepo tooling, remote caching |
| CLI framework | **yargs** | Shell completion, subcommands, scriptable |
| Cache backend | **better-sqlite3** on disk + LRU in memory | Embedded, zero-config |
| Data flow | **Streaming-first** | Retrofitting streaming onto buffered is painful; buffering on top of streaming is trivial |
| Internal data format | **Apache Arrow (columnar)** | Zero-copy, typed arrays, no GC pressure, 10-50x faster than row-object model |
| Protocol hot path | **Rust via napi-rs** | Parse wire protocol directly into Arrow buffers — never create per-row JS objects |
| Error model | **Typed error codes from day 1** | Changing error shapes later breaks every consumer |
| Config model | **Layered with clear precedence** | Adding layers later creates ambiguity |
| Philosophy | **File Over App** | Open formats, self-managed credentials, no proprietary lock-in — your data and config are always yours |

---

## File Over App

Maître d'B adopts a **"file over app"** philosophy: your data, configuration, credentials,
and workflows should live in open, human-readable, non-proprietary formats that you control —
not locked inside a binary, a vendor's cloud, or a format only one tool can read.

This isn't just about portability. It's about **longevity and autonomy**. Applications come
and go. Files on disk, in standard formats, survive them all.

### What this means in practice

| Concern | File Over App approach | What we avoid |
|---|---|---|
| **Credentials** | Encrypted JSON file (`~/.maitredb/credentials.enc`) as the default store — human-inspectable structure, self-managed, no vendor account required | Proprietary credential vaults that require a SaaS account, browser-based OAuth re-auth on every cold start, paid "enterprise" connectors |
| **Connection config** | Plain JSON (`connections.json`) — version-controllable, diffable, editable by hand | Binary config blobs, app-internal databases, formats that require the app to read |
| **Data export** | Apache Iceberg / Parquet as default dump targets — open standards readable by dozens of engines | `pg_dump`, `mysqldump`, `mongodump` and other single-vendor formats that lock data to one database |
| **Query workflows** | `.sql` files as first-class citizens — `mdb query prod --file report.sql` | Proprietary notebook formats, query builders that can't export, saved queries trapped in an app's internal storage |
| **Saved queries** | `.maitredb/queries/*.sql` — plain SQL files in your project, committable to git | Query libraries locked inside a GUI, cloud-only query history |
| **Masking policies** | JSON config files (`masking.json`) — reviewable, version-controlled | UI-only masking configuration with no export |
| **Audit history** | SQLite database (`history.db`) — open format, queryable by any SQLite client | Proprietary log formats, cloud-only audit trails |
| **Telemetry** | None. Zero telemetry, zero phone-home, zero analytics. Your usage is your business. | In-app telemetry, usage tracking, "anonymous" analytics that aren't |
| **Drivers** | Native, open-source Node.js drivers (`pg`, `mysql2`, `mongodb`, etc.) | Paid proprietary drivers, JDBC bridges that require a JVM, "connectors" with per-seat licensing |

### The test

Before adding any feature, we ask: **if the user uninstalls Maître d'B tomorrow, can they
still access everything they created with it?**

- Connections? Yes — `connections.json` is documented JSON.
- Credentials? Yes — the encryption format is documented, and env var / keychain fallbacks exist.
- Exported data? Yes — it's Iceberg/Parquet/CSV/SQL, readable by anything.
- Query history? Yes — it's a SQLite file.
- Saved queries? Yes — they're `.sql` files.
- Masking/governance policies? Yes — they're JSON.

If the answer is ever "no", the design is wrong.

---

## The Metaphor, Applied

| Restaurant | Maître d'B | What it means |
|---|---|---|
| Reservations | Connection pooling | Pre-established, managed connections with limits |
| Seating | Query scheduling & sequencing | Queue, prioritize, and route queries to the right connection |
| The Menu | Schema introspection | What's available — tables, columns, types, functions |
| Orders | Queries | Submitted by customers, routed to the kitchen |
| Kitchen | The database | Does the actual work, Maître d'B never enters |
| Customers | Humans & agents | Both get the same quality of service, different interfaces |
| House Rules | Governance & security policies | Read-only mode, row limits, allowed schemas, rate limits |
| The Bill | Query profiling & cost | What the order cost in time, rows scanned, buffers hit |
| VIP List | Saved connections & credentials | Known regulars don't re-authenticate every visit |
| Front Desk Log | Audit trail | Who ordered what, when, from which table |

---

## Monorepo Structure

```
maitredb/
├── apps/
│   ├── cli/                    # @maitredb/cli — the `mdb` binary
│   └── gui/                    # @maitredb/gui — Tauri 2 desktop app
├── packages/
│   ├── core/                   # Connection manager, query executor, introspection
│   ├── cache/                  # Memory LRU + SQLite disk cache
│   ├── governance/             # Agent security policies, query validation, data masking
│   ├── faker/                  # Data bootstrapping — fake data generation
│   ├── dump/                   # Universal dump — extract to Parquet/Iceberg/CSV
│   ├── wire/                   # Rust native addon (napi-rs) — protocol parsing → Arrow
│   ├── driver-postgres/        # pg
│   ├── driver-mysql/           # mysql2 (covers MariaDB via dialect flag)
│   ├── driver-mongodb/         # mongodb
│   ├── driver-snowflake/       # snowflake-sdk
│   ├── driver-clickhouse/      # @clickhouse/client
│   ├── driver-sqlite/          # better-sqlite3
│   ├── driver-duckdb/          # @duckdb/node-api
│   ├── driver-bigquery/        # @google-cloud/bigquery
│   ├── driver-redshift/        # @aws-sdk/client-redshift-data (or pg for direct)
│   ├── driver-athena/          # @aws-sdk/client-athena
│   └── plugin-api/             # DriverAdapter interface + plugin registry
```

---

## Zero-Install & npx/bunx Access

The CLI must work as a zero-install tool:

```bash
npx maitredb query prod "SELECT count(*) FROM orders"
bunx maitredb schema prod tables --format json
```

### Design constraints this imposes

- **Lean native dependencies**: Native modules (better-sqlite3, keytar) require compilation and break npx cold-start. Strategy:
  - Use **prebuild-install** for prebuilt binaries (covers macOS/Linux/Windows x64 + arm64)
  - Provide **pure-JS fallbacks**: file-based encrypted credential store when keytar is unavailable, in-memory-only cache when better-sqlite3 can't load
  - The `maitredb` npm package should list native deps as **optional dependencies** so install doesn't fail if compilation fails
- **`bin` field in package.json**: `"bin": { "mdb": "./dist/cli.js", "maitredb": "./dist/cli.js" }` — both short and long forms
- **Fast startup**: Lazy-load drivers. Don't `require('snowflake-sdk')` until a Snowflake connection is actually requested. This keeps `mdb schema prod tables` snappy even if only `pg` is needed.

### What this enables for agents

An agent in an ephemeral environment (CI, container, sandbox) runs `npx maitredb query mydb "..."` — no install step, no version management, no credential exposure. The connection config and credentials are resolved from the host's `~/.maitredb/` directory, never passed as arguments.

### Agent cold-start optimization

Agents spin up frequently in fresh sandboxes. Every millisecond of startup matters.
Maître d'B optimizes the cold path specifically for this use case:

- **Single-driver loading**: When an agent runs `mdb query prod "..."`, only the driver
  for `prod`'s database type is loaded. No other driver code is imported.
- **Skip GUI dependencies**: CLI-only execution path never imports React, Tauri, Monaco,
  or any GUI-related modules — even if they're installed.
- **Deferred cache initialization**: The SQLite disk cache is opened lazily on first cache
  miss, not at startup. For a single query, no disk cache is needed at all.
- **Minimal credential resolution**: If credentials are provided via environment variable
  (`MDB_CONN_<NAME>_DSN`), skip keychain and encrypted file checks entirely.
- **Precomputed connection configs**: A `--config-inline` flag accepts a base64-encoded
  connection config for zero-filesystem agent invocations:
  ```bash
  mdb query --config-inline "eyJ0eXBlIjoicG9zdGdyZXMiLC..." "SELECT 1"
  ```
- **Target**: Cold `npx maitredb query` from a fresh sandbox should complete a simple
  query in **under 2 seconds** including npm resolution, startup, connect, execute, and output.

---

## Credential Isolation & Secret Management

This is a core differentiator. Agents should **never see credentials**.

### The flow

1. **Human sets up connections once** (interactive):
   ```bash
   mdb connect add prod --type postgres --host db.example.com --port 5432 --user admin --database app
   # Prompts for password, stores encrypted
   ```

2. **Agent uses connections by name**:
   ```bash
   mdb query prod "SELECT * FROM users LIMIT 10"
   # Credentials resolved internally — never appear in args, env, or output
   ```

3. **Audit trail** records what was queried without exposing secrets.

### Storage layers (in order of preference)

| Layer | When used | How |
|---|---|---|
| **System keychain** | Desktop with keytar available | macOS Keychain, Windows Credential Vault, Linux libsecret |
| **Encrypted file** | Headless / containers / npx fallback | `~/.maitredb/credentials.enc` — AES-256-GCM, key derived from machine ID + user-supplied master password |
| **Environment variables** | CI / containers | `MDB_CONN_<NAME>_DSN` or `MDB_CONN_<NAME>_PASSWORD` — opt-in, not default |
| **Mounted secrets file** | Kubernetes / Docker | `--credentials-file /run/secrets/maitredb.json` |

### Re-authentication avoidance

OAuth, SSO, and browser-based auth flows are **the single slowest part of any database
client's startup**. A Snowflake browser-based SSO flow takes 5-15 seconds. For an agent
running in a headless sandbox, it's impossible — there's no browser.

Maître d'B avoids re-auth by design:

- **Token caching**: OAuth access tokens and refresh tokens are stored in the credential
  store with their expiry. If a valid token exists, no auth flow is triggered.
- **Token refresh**: When an access token expires but a refresh token is still valid,
  refresh happens silently (no browser, no user interaction).
- **Key-pair auth preferred**: For databases that support it (Snowflake, PostgreSQL
  certificate auth), key-pair is the recommended auth method — no tokens, no expiry,
  no browser.
- **Service account credentials**: For agent/CI use, service account keys or IAM roles
  are preferred over user-interactive auth. BigQuery ADC, AWS IAM, Snowflake key-pair.
- **Auth method hierarchy**: Each connection config specifies an auth preference order:
  ```jsonc
  {
    "prod-snowflake": {
      "type": "snowflake",
      "auth": ["key-pair", "token-cache", "oauth-refresh", "browser-sso"],
      // Falls through the list — browser SSO is last resort, never used by agents
    }
  }
  ```
- **Agent mode skips interactive auth**: When running with `--as agent` or in MCP server
  mode, any auth method that requires user interaction (browser SSO, password prompt)
  is skipped. If no non-interactive method succeeds, a clear error is returned rather
  than hanging on a browser popup that will never be clicked.

### Connection config file

`~/.maitredb/connections.json` stores **non-secret** connection metadata (host, port, database, type, options). Passwords/tokens are **never** in this file — they live in the credential store above.

```jsonc
{
  "connections": {
    "prod": {
      "type": "postgresql",
      "host": "db.example.com",
      "port": 5432,
      "user": "admin",
      "database": "app",
      "ssl": true,
      "pool": { "min": 2, "max": 10 }
      // no password here
    }
  }
}
```

---

## Driver Adapter Interface

Every database implements a single `DriverAdapter` contract:

```typescript
export interface DriverAdapter {
  readonly dialect: DatabaseDialect;

  // Lifecycle
  connect(config: ConnectionConfig): Promise<Connection>;
  disconnect(conn: Connection): Promise<void>;
  testConnection(config: ConnectionConfig): Promise<ConnectionTestResult>;
  validateConnection(conn: Connection): Promise<boolean>; // health check

  // Execution — streaming-first
  execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult>;
  stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Row>;
  cancelQuery(conn: Connection, queryId: string): Promise<void>;

  // Transactions
  beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction>;

  // Introspection
  getSchemas(conn: Connection): Promise<SchemaInfo[]>;
  getTables(conn: Connection, schema: string): Promise<TableInfo[]>;
  getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]>;
  getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]>;
  getFunctions(conn: Connection, schema: string): Promise<FunctionInfo[]>;
  getProcedures(conn: Connection, schema: string): Promise<ProcedureInfo[]>;

  // Permissions
  getRoles(conn: Connection): Promise<RoleInfo[]>;
  getGrants(conn: Connection, role?: string): Promise<GrantInfo[]>;

  // Tracing
  explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult>;

  // Types
  mapNativeType(nativeType: string): MaitreType;

  // Capabilities — what this driver supports
  capabilities(): DriverCapabilities;
}

export interface DriverCapabilities {
  transactions: boolean;
  streaming: boolean;
  explain: boolean;
  explainAnalyze: boolean;
  procedures: boolean;
  roles: boolean;
  schemas: boolean;        // some DBs are schema-less
  cancelQuery: boolean;
  listenNotify: boolean;   // postgres-style pub/sub
  asyncExecution: boolean; // BigQuery/Athena/Redshift Data API — submit, poll, fetch
  embedded: boolean;       // SQLite/DuckDB — in-process, no network
  costEstimate: boolean;   // can estimate query cost before execution (cloud warehouses)
}

export type DatabaseDialect =
  | 'sqlite' | 'postgresql' | 'mysql' | 'mariadb' | 'snowflake'
  | 'mongodb' | 'clickhouse' | 'duckdb'
  | 'bigquery' | 'redshift' | 'athena';
```

The `capabilities()` method is critical — it lets the CLI and GUI gracefully degrade features per database instead of throwing "not supported" errors everywhere.

### Async execution model (cloud warehouses)

BigQuery, Athena, and Redshift Data API use an **async job pattern** rather than synchronous
request-response. The `DriverAdapter` contract handles this transparently:

1. `execute()` submits the query and receives a job/statement ID
2. The driver polls for completion internally (with configurable timeout)
3. Results are fetched once ready (Arrow format when available)

From the caller's perspective, `execute()` and `stream()` behave identically to synchronous
drivers — the async polling is an implementation detail hidden inside the driver adapter.
Connection pooling is either unnecessary (Athena — fully stateless) or minimal (BigQuery —
one authenticated client per project, no TCP pool).

---

## Database Drivers

| Database | npm Package | Notes |
|---|---|---|
| SQLite | `better-sqlite3` v11 | Embedded, synchronous API (fastest for single-process), zero network. Already a dependency for cache — promote to full driver. WAL mode by default. |
| PostgreSQL | `pg` v8 | Streaming, COPY, LISTEN/NOTIFY, full catalog introspection |
| MySQL/MariaDB | `mysql2` v3 | Dialect flag distinguishes MariaDB-specific features |
| MongoDB | `mongodb` v6 | Non-SQL; `execute()` accepts structured `MongoOperation` or minimal SQL-to-MQL |
| Snowflake | `snowflake-sdk` v2.3 | Key-pair auth, SSO, multi-statement |
| ClickHouse | `@clickhouse/client` v1.18 | Zero deps, streaming selects and inserts |
| DuckDB | `@duckdb/node-api` v1.5 | Embedded — no server, connects to local files |
| BigQuery | `@google-cloud/bigquery` v7 | Serverless, pay-per-query. Async job model — queries return a job ID, poll for results. Arrow result format supported. Application Default Credentials (ADC) or service account key. |
| Redshift | `@aws-sdk/client-redshift-data` v3 | Uses Redshift Data API (HTTP-based, no persistent connection). Async statement execution. IAM auth or Secrets Manager. Shares PostgreSQL wire protocol for direct connections via `pg`. |
| Athena | `@aws-sdk/client-athena` v3 | Serverless SQL over S3. Fully async — submit query, poll for completion, fetch results from S3. No connection pooling (stateless). IAM auth. Results land as CSV/Parquet in S3 staging bucket. |

---

## Streaming-First Architecture

**Design principle**: All data flows as streams. Buffering into arrays is a convenience built *on top* of streaming, never the other way around.

### Why this matters at the foundation level

- An agent runs `SELECT * FROM events` — 50M rows. Buffered = OOM. Streaming = fine.
- GUI shows first results in <100ms while the rest loads. Buffered = wait for all rows.
- Pipe to file: `mdb query prod "SELECT ..." --format csv > export.csv` — constant memory.

### Implementation

```typescript
// The primitive is always a stream
stream(conn, query, params?): AsyncIterable<Row>

// Buffered execute is sugar on top
async execute(conn, query, params?): Promise<QueryResult> {
  const rows: Row[] = [];
  for await (const row of this.stream(conn, query, params)) {
    rows.push(row);
    if (rows.length > MAX_BUFFERED_ROWS) {
      throw new ResultTooLargeError(rows.length, MAX_BUFFERED_ROWS);
    }
  }
  return { rows, fields, rowCount: rows.length };
}
```

### Result size safety

- Default `MAX_BUFFERED_ROWS` = 10,000 for `execute()`. Configurable per-connection.
- `stream()` has no limit — caller manages backpressure.
- CLI `--stream` flag uses `stream()` directly; default mode uses `execute()` with the safety limit.
- GUI paginates: fetches in pages of 500 rows, virtual-scrolls the rest.

---

## Performance Architecture

The fastest databases in the world (kdb+, HeavyDB, DuckDB, StarRocks, TigerBeetle) are bottlenecked by
their clients. A Postgres query that executes in 2ms on the server can take 500ms to
materialize on the client because every row becomes a JS heap object, every integer is
parsed from a UTF-8 string, and the GC chokes on millions of small allocations.

Maître d'B refuses to be that bottleneck. The performance architecture is designed around
one principle borrowed from kdb+: **the wire format should match the memory format as
closely as possible, and that format should be columnar.**

### The problem with every existing Node.js database client

```
Database server (fast, columnar internally)
  → Wire protocol (text: "12345", "2024-01-15T10:30:00Z", "true")
    → JS driver parses each field: parseInt(), new Date(), === "t"
      → Creates one JS Object per row: { id: 12345, created: Date, active: true }
        → 1M rows = 1M objects = ~500MB-1GB heap = GC pauses = slow
```

The costs at 1M rows, 20 columns:
- **50M function calls** for type coercion (50M `parseInt`, `new Date`, etc.)
- **1M object allocations**, each with V8 hidden class, property backing store
- **500MB-1GB heap** just for the row objects
- **Major GC pauses** of 50-200ms each, scaling with live object count
- **Cache thrashing**: accessing one column across all rows jumps through memory
  (each row object is at a different heap location)

### Maître d'B's approach: Arrow-native, Rust-parsed

```
Database server
  → Wire protocol (binary when available)
    → Rust native addon (@maitredb/wire via napi-rs)
      → Parses protocol bytes directly into Arrow columnar buffers
        → Returns Arrow RecordBatch to JS (backed by ArrayBuffer — one allocation)
          → 1M rows = ~3 objects (one per column buffer) = ~80MB = zero GC pressure
```

### Layer 1: Binary protocols by default

| Database | Text protocol cost | Binary protocol cost | Savings |
|---|---|---|---|
| **PostgreSQL** | `parseInt("1234567890")` = 10 bytes + parse | `buffer.readInt32BE()` = 4 bytes, one instruction | ~60% fewer bytes, ~10x faster parse |
| **MySQL** | Text rows via COM_QUERY | Binary rows via COM_STMT_EXECUTE (prepared) | ~30-40% faster on numeric-heavy |
| **ClickHouse** | `JSONEachRow` format | `ArrowStream` format — **zero parsing** | 100x+ for large results |
| **DuckDB** | N/A (in-process) | Native Arrow via C API — **zero copy** | Effectively free |
| **Snowflake** | JSON result format | Arrow result format (supported since 2023) | 10-50x for large results |
| **MongoDB** | N/A | BSON is already binary, but nested | Use `bson-ext` C++ addon |

**Driver implementation**: Each driver adapter negotiates the fastest available protocol:
1. Arrow-native if supported (DuckDB, ClickHouse, Snowflake)
2. Binary protocol if available (Postgres, MySQL)
3. Text protocol as fallback only (with Rust parser for the hot path)

### Layer 2: Rust wire protocol parser (`@maitredb/wire`)

A Rust native addon built with **napi-rs** that handles the parsing hot path:

```
packages/wire/
├── Cargo.toml
├── src/
│   ├── lib.rs                    # napi-rs entry point
│   ├── postgres/
│   │   ├── mod.rs
│   │   ├── binary_parser.rs      # parse PG binary protocol → Arrow buffers
│   │   └── text_parser.rs        # parse PG text protocol → Arrow buffers (fallback)
│   ├── mysql/
│   │   ├── mod.rs
│   │   └── binary_parser.rs      # parse MySQL COM_STMT_EXECUTE → Arrow buffers
│   ├── arrow/
│   │   ├── mod.rs
│   │   ├── builder.rs            # Arrow RecordBatch construction
│   │   └── ipc.rs                # Arrow IPC serialization for cross-thread transfer
│   ├── masking/                   # hot-path masking in Rust
│   │   ├── hash.rs               # SHA-256 truncated hashing
│   │   ├── partial.rs            # format-preserving partial masking
│   │   ├── noise.rs              # statistical noise injection
│   │   └── redact.rs             # constant-value replacement
│   └── compression/
│       └── zstd.rs               # zstd compression for Arrow IPC buffers
├── npm/                          # prebuilt binaries per platform
│   ├── darwin-arm64/
│   ├── darwin-x64/
│   ├── linux-x64-gnu/
│   ├── linux-arm64-gnu/
│   └── win32-x64-msvc/
└── __test__/
    └── benchmark.ts
```

**Key design principle**: Cross the JS↔Rust boundary as few times as possible with large
payloads. One call to parse an entire result buffer, not one call per row.

```typescript
// JS side — one call, entire result set
import { parsePostgresBinary } from '@maitredb/wire'

const arrowIpcBuffer: ArrayBuffer = parsePostgresBinary(
  rawProtocolBytes,   // Buffer from socket
  columnTypes,        // OID array from RowDescription message
  columnNames,        // string array
)

// Wrap zero-copy as Apache Arrow RecordBatch
import { tableFromIPC } from 'apache-arrow'
const table = tableFromIPC(arrowIpcBuffer)

// Columnar access — typed arrays, contiguous memory
const ids: Int32Array = table.getChild('id')!.toArray()        // zero-copy view
const emails: string[] = table.getChild('email')!.toArray()    // string column
```

### Layer 3: Arrow as the internal data format

Apache Arrow `RecordBatch` is the canonical result representation throughout Maître d'B.

**Why Arrow specifically:**
- **Zero-copy**: Arrow IPC buffers can be wrapped by JS typed arrays without copying
- **Typed arrays**: `Int32Array`, `Float64Array`, `BigInt64Array` are V8 primitives backed by
  contiguous `ArrayBuffer` — one GC root per column, not per value
- **Cache-friendly**: Iterating a column is sequential memory access — CPU prefetchers
  handle this optimally (~10x faster than scattered object property access)
- **Null bitmaps**: 1 bit per value, not a per-value `null` check
- **Cross-language**: Same format in Rust, Python, Java, C++. The dump/Iceberg pipeline,
  the masking engine, and the GUI can all consume the same buffers
- **Compression-friendly**: Columnar data compresses 10-20x (same-type values in sequence)

**Ergonomic layer on top:**

Arrow is fast but `table.getChild('name')!.get(0)` isn't friendly. We provide both:

```typescript
// Fast path — columnar (Arrow RecordBatch)
const result = await mdb.query(conn, 'SELECT * FROM users')
result.numRows         // 1,000,000
result.schema          // Arrow Schema with field types
result.column('id')    // Int32Array (zero-copy view)
result.column('email') // Arrow Utf8Vector

// Ergonomic path — row iteration (lazy, never materializes all rows at once)
for (const row of result.rows()) {
  console.log(row.id, row.email)  // Proxy object, reads from Arrow buffers on access
}

// Convenience — materialize to objects (only when explicitly requested)
const objects = result.toObjects()  // Array<Object> — allocated on demand
// ⚠ Warning logged if > 10K rows: "Consider using .rows() or .column() for large results"
```

The `row` in the iterator is a **Proxy** that reads from the underlying Arrow column buffers
on property access. No objects are pre-allocated. If you only access 3 of 20 columns, only
those 3 columns are touched.

### Layer 4: Worker threads for CPU-bound transforms

The masking engine, hashing, compression, and format conversion run on a worker pool:

```
Main thread (event loop)
  ├── Receives query result as Arrow IPC ArrayBuffer
  ├── Transfers (zero-copy) to worker pool
  │
  Worker pool (piscina, 4 workers default)
  ├── Worker 1: mask columns 1-5 (Rust via @maitredb/wire)
  ├── Worker 2: mask columns 6-10
  ├── Worker 3: compress result for cache
  └── Worker 4: (available for next query)
  │
  ├── Transfers masked ArrayBuffer back (zero-copy)
  │
Main thread
  └── Serves result to CLI output / GUI / API consumer
```

**Data transfer**: `ArrayBuffer` transfer via `postMessage(data, [data])` is zero-copy
(ownership moves, ~microseconds regardless of size). No `structuredClone`, no serialization.

**SharedArrayBuffer** for read-heavy scenarios: When multiple transforms need to read
the same source data, use SAB so all workers share one copy.

### Layer 5: Prepared statement caching

Every query that's been seen before skips parse/plan on the server:

```typescript
// Automatic LRU cache per connection (transparent to user)
// First execution: parse + plan + execute (~500μs overhead)
// Subsequent: execute only (~50μs)

export class PreparedStatementCache {
  private cache: LRUCache<string, PreparedStatement>  // keyed by SQL hash
  private maxSize: number = 256  // per connection

  async execute(conn, sql, params): Promise<ArrowIpcBuffer> {
    const key = xxhash(sql)  // fast non-crypto hash
    let stmt = this.cache.get(key)
    if (!stmt) {
      stmt = await conn.prepare(sql)
      this.cache.set(key, stmt)
    }
    return stmt.execute(params)
  }
}
```

**Postgres specifics**: Named prepared statements persist server-side for the connection
lifetime. When a connection returns to the pool, its statement cache is preserved (same
connection = same prepared statements).

**MySQL specifics**: `mysql2` already supports prepared statement caching via
`{ cachePreparedStatements: true }`. We enable this by default.

### Layer 6: Streaming with backpressure in Arrow batches

Streaming doesn't mean "one row at a time" — that's as bad as buffering everything.
Stream in **Arrow RecordBatches** of configurable size:

```typescript
// Stream in batches of 10,000 rows, each batch is one Arrow RecordBatch
for await (const batch of mdb.stream(conn, 'SELECT * FROM events', {
  batchSize: 10_000,
})) {
  // batch is an Arrow RecordBatch — 10K rows, columnar, typed arrays
  // Process entire batch at once (vectorized operations possible)
  const timestamps = batch.column('created_at')  // Int64Array of microseconds
  // ...
}
```

**Backpressure**: The `AsyncIterable` naturally applies backpressure. If the consumer is
slow, the producer (socket reads) pauses. Node.js streams handle this via the `highWaterMark`
mechanism. Arrow batch size acts as the buffering unit.

### Performance targets

With this architecture, compared to stock `pg` or `mysql2` returning `Array<Object>`:

| Metric | Stock Node.js driver | Maître d'B | Improvement |
|---|---|---|---|
| **Parse throughput (1M rows)** | 2-5 seconds | 100-300ms | **10-50x** |
| **Memory (1M rows, 20 cols)** | 500MB-1GB | 40-80MB | **10-20x** |
| **GC pauses** | 50-200ms major pauses | Near-zero (typed arrays) | **Eliminated** |
| **First-row latency** | Same as total (buffered) | <10ms (streaming batch) | **Instant** |
| **Column scan (SUM 1M ints)** | ~50ms (cache thrashing) | ~2ms (contiguous array) | **25x** |
| **Small query latency** | ~500μs (parse+plan) | ~50μs (prepared stmt cache) | **10x** |

### Fallback path (no native addon)

The Rust addon (`@maitredb/wire`) is an **optional dependency**. If it can't load (npx cold
start, unsupported platform, WASM-only environment):

1. Fall back to stock driver parsing (`pg`, `mysql2`, etc.)
2. Convert `Array<Object>` to Arrow `RecordBatch` in JS (slower, but still gives columnar
   benefits for downstream operations like masking and dump)
3. Log a one-time notice: "Native parser unavailable — using JS fallback. Install
   @maitredb/wire for 10-50x faster results."

This ensures `npx maitredb` always works, with a graceful performance degradation path.

### Per-database fast paths

| Database | Optimal path | What Maître d'B does |
|---|---|---|
| **DuckDB** | Arrow-native via C API | `duckdb_query_arrow()` → Arrow RecordBatch, zero parsing |
| **ClickHouse** | `FORMAT ArrowStream` via HTTP | Request Arrow format, receive Arrow IPC, zero parsing |
| **Snowflake** | Arrow result format | SDK supports Arrow results since 2023, wrap directly |
| **PostgreSQL** | Binary protocol + Rust parser | Rust addon parses binary PG wire → Arrow buffers |
| **MySQL/MariaDB** | Binary protocol (prepared) + Rust parser | Rust addon parses COM_STMT_EXECUTE → Arrow buffers |
| **MongoDB** | `bson-ext` C++ + Rust column builder | BSON to columnar requires doc-by-doc scan (inherent to document model) |
| **SQLite** | In-process, shared memory | Already local — no network, no protocol parsing. Read directly into Arrow via column-type mapping |
| **BigQuery** | Arrow result format via Storage Read API | `google.cloud.bigquery.storage.v1` streams Arrow RecordBatches directly — zero parsing |
| **Redshift** | Binary PG protocol (direct) or JSON (Data API) | Direct connection reuses PG binary path; Data API returns JSON (slower, but no VPC needed) |
| **Athena** | Results as Parquet in S3 | Query results land in S3 as CSV/Parquet — read Parquet directly into Arrow via DuckDB |

### What we explicitly avoid

- **Never return `Array<Object>` as the primary format** — it is the single largest performance killer
- **Never parse protocol bytes in JavaScript** for result sets beyond a few thousand rows
- **Never use `JSON.stringify()` for large results** — use Arrow IPC or schema-compiled serializer
- **Never create a new prepared statement for every execution** of the same SQL
- **Never buffer entire result sets in memory** before the consumer sees the first row

---

## Connection Lifecycle & Health

Connections are not just "open or closed" — they need active lifecycle management, especially when agents may hold connections for extended periods or abandon them.

### Connection pooling

Each saved connection can configure pool parameters:

```jsonc
{
  "pool": {
    "min": 0,          // idle minimum (0 = close when unused)
    "max": 10,         // max concurrent
    "idleTimeoutMs": 30000,
    "acquireTimeoutMs": 10000,
    "maxWaitingClients": 20  // queue depth before rejecting
  }
}
```

The `ConnectionManager` wraps each driver's native pooling (pg's `Pool`, mysql2's `createPool`) or implements generic pooling for drivers that don't support it natively (snowflake-sdk).

### Health checks

- **Validation query**: Before handing a connection to a caller, run a lightweight check (`SELECT 1`, or driver-specific ping). Configurable interval.
- **Auto-reconnect**: If a connection drops mid-session, attempt transparent reconnect for stateless operations (schema introspection, single queries). Never auto-reconnect mid-transaction.
- **Keepalive**: Configurable TCP keepalive and application-level heartbeat to prevent firewall/load-balancer timeouts.

### SSH Tunnels

SSH tunnel support is part of the connection lifecycle, not an afterthought:

```jsonc
{
  "prod": {
    "type": "postgresql",
    "host": "10.0.1.5",
    "port": 5432,
    "tunnel": {
      "host": "bastion.example.com",
      "port": 22,
      "user": "deploy",
      "privateKey": "~/.ssh/id_ed25519"
      // password/passphrase resolved from credential store
    }
  }
}
```

The tunnel is established before the database connection and torn down after disconnect. Uses `ssh2` package.

---

## Caching Strategy

| Data | TTL | Storage | Invalidation |
|---|---|---|---|
| Schema metadata (tables, columns, indexes) | 5 min (configurable) | Memory LRU + disk (SQLite) | Manual refresh; auto after DDL execution |
| Function/procedure definitions | 5 min | Memory + disk | Same as schema |
| Permission/grant data | 2 min | Memory only | Manual refresh |
| Query results | Off by default, opt-in | Memory LRU (configurable max size) | Hash key: connection+query+params |
| Connection metadata | Session lifetime | Memory | On disconnect |

**Cache key structure**: `{connectionId}:{dialect}:{operation}:{schema}:{object}`

**DDL detection**: The query executor inspects queries before execution. If a query begins with `CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE`, relevant cache segments are invalidated after execution.

**Disk store**: `better-sqlite3` in `~/.maitredb/cache.db`. Falls back to memory-only if the native module isn't available (npx scenario).

---

## Query Tracing & Profiling

Per-database EXPLAIN is normalized into a unified `PlanNode` tree:

```typescript
export interface ExplainResult {
  dialect: DatabaseDialect;
  rawPlan: unknown;              // original driver output, preserved
  plan: PlanNode;                // normalized tree
  totalTimeMs?: number;
  rowsEstimated?: number;
  rowsActual?: number;
  warnings: string[];            // "Sequential scan on large table", etc.
}

export interface PlanNode {
  operation: string;             // "Seq Scan", "Hash Join", etc.
  table?: string;
  index?: string;
  cost?: { startup: number; total: number };
  rows?: { estimated: number; actual?: number };
  timeMs?: { estimated?: number; actual?: number };
  buffers?: { hit?: number; read?: number; written?: number };
  children: PlanNode[];
  properties: Record<string, unknown>;
}
```

| Database | EXPLAIN approach |
|---|---|
| PostgreSQL | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` |
| MySQL/MariaDB | `EXPLAIN FORMAT=JSON` / `EXPLAIN ANALYZE` (8.0.18+) |
| Snowflake | `EXPLAIN USING JSON` + `GET_QUERY_OPERATOR_STATS()` |
| ClickHouse | `EXPLAIN PIPELINE` + `system.query_log` |
| DuckDB | `EXPLAIN ANALYZE` / `PRAGMA enable_profiling='json'` |
| MongoDB | `cursor.explain("executionStats")` |
| SQLite | `EXPLAIN QUERY PLAN` |
| BigQuery | `EXPLAIN` (preview) + job statistics (`totalBytesProcessed`, `totalSlotMs`) |
| Redshift | `EXPLAIN` (PostgreSQL-compatible) + `STL_QUERY` / `SVL_QUERY_REPORT` system tables |
| Athena | `EXPLAIN` / `EXPLAIN ANALYZE` + query execution statistics from `GetQueryExecution` |

CLI renders as an indented tree; GUI renders as a visual DAG via React Flow.

---

## Native Optimization Recommendations

Maître d'B already knows your query patterns (from audit history) and your table structure
(from schema introspection). It can use this knowledge to suggest **backend-specific
optimizations** — the kind of advice a senior DBA would give after reviewing your workload.

This is not query rewriting or automatic tuning. It's **recommendation-only**: analyze,
suggest, explain why. The human decides whether to act.

### Interface

```bash
# Analyze a specific connection and suggest optimizations
mdb optimize <conn> [--schema public] [--tables users,orders]

# Focus on a specific concern
mdb optimize <conn> --focus indexes      # missing/unused indexes
mdb optimize <conn> --focus queries      # slow query patterns from history
mdb optimize <conn> --focus storage      # bloat, vacuum, compression
mdb optimize <conn> --focus config       # database configuration tuning

# Output as JSON for programmatic consumption
mdb optimize <conn> --format json
```

### What it analyzes

```typescript
export interface OptimizationReport {
  connection: string;
  dialect: DatabaseDialect;
  analyzedAt: Date;
  recommendations: Recommendation[];
}

export interface Recommendation {
  category: 'index' | 'query' | 'storage' | 'config' | 'schema';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  sql?: string;             // suggested DDL/command to implement the recommendation
  impact?: string;          // expected improvement: "~40% faster reads on users table"
  evidence: {
    source: 'introspection' | 'query_history' | 'explain' | 'system_stats';
    detail: string;         // what was observed
  };
}
```

### Per-database recommendations

| Database | What `mdb optimize` can suggest |
|---|---|
| **PostgreSQL** | Missing indexes (from sequential scans in `pg_stat_user_tables`), unused indexes (zero scans), table bloat (`n_dead_tup`), VACUUM/ANALYZE needs, `work_mem`/`shared_buffers` sizing, missing `FILLFACTOR` on hot-update tables |
| **MySQL/MariaDB** | Missing indexes (from slow query log or `performance_schema`), redundant indexes, InnoDB buffer pool sizing, query cache hit rates (MariaDB), `innodb_flush_log_at_trx_commit` tradeoffs |
| **Snowflake** | Clustering key recommendations (based on frequent `WHERE`/`JOIN` columns from query history), warehouse auto-suspend settings, materialized view candidates for repeated aggregations |
| **ClickHouse** | `ORDER BY` key selection (from common filter patterns), materialized view candidates, codec/compression recommendations per column type, partition key sizing |
| **BigQuery** | Partition column recommendations (date/timestamp columns in `WHERE` clauses), clustering column suggestions (up to 4), slot usage analysis, materialized view candidates |
| **Redshift** | Distribution key / sort key recommendations (from `svv_table_info` and query patterns), `VACUUM` / `ANALYZE` needs, WLM queue configuration |
| **DuckDB** | Largely self-optimizing — suggest persistent indexes for repeated analytical queries, file format recommendations (Parquet vs CSV sources) |
| **SQLite** | Missing indexes (from `EXPLAIN QUERY PLAN` showing full scans), `PRAGMA` tuning (`journal_mode=WAL`, `synchronous=NORMAL`), `VACUUM` for fragmented databases |
| **Athena** | Partition projection recommendations, file format/compression suggestions for source data in S3, column pruning opportunities |

### How it works

```
mdb optimize <conn>
  → Introspect schema (tables, columns, indexes, constraints)
  → Pull query history from audit log (filtered to this connection)
  → For top-N most frequent/slowest queries:
    → Run EXPLAIN (if not already cached)
    → Identify sequential scans, missing index usage, large row estimates
  → Query database system tables for statistics (bloat, cache hit ratios, etc.)
  → Cross-reference: frequent filter columns without indexes, unused indexes, etc.
  → Generate prioritized recommendations
  → Output as formatted table (CLI) or report panel (GUI)
```

The optimization engine lives in `@maitredb/core` and each driver adapter exposes
a `getSystemStats()` method for database-specific statistics collection.

---

## Database Benchmarking

A built-in benchmarking tool for measuring query performance with statistical rigor. Run the
same query (or a standard test pattern) N times, collect latency percentiles, and detect
regressions across runs.

### Interface

```bash
# Benchmark a custom query
mdb bench <conn> "SELECT * FROM orders WHERE status = 'shipped'" \
  --runs 100 --interval 1s

# Pre-filled standard benchmarks (no SQL needed)
mdb bench <conn> --inner-join --runs 50 --interval 10s
mdb bench <conn> --aggregate --runs 100
mdb bench <conn> --full-scan --runs 20
mdb bench <conn> --point-lookup --runs 500 --interval 100ms
mdb bench <conn> --write-insert --runs 100

# Run a suite of standard benchmarks
mdb bench <conn> --suite standard --runs 50

# Compare two connections (e.g., before/after an index, or prod vs staging)
mdb bench <conn1> <conn2> "SELECT ..." --runs 100 --compare

# Output formats
mdb bench <conn> --inner-join --runs 50 --format json
mdb bench <conn> --inner-join --runs 50 --format csv > results.csv
```

### Pre-filled benchmark templates

Standard query patterns that run against **any** database without the user writing SQL.
Maître d'B introspects the schema, picks suitable tables/columns, and generates the
appropriate query for the dialect.

| Flag | What it tests | Generated query (conceptual) |
|---|---|---|
| `--point-lookup` | Single-row fetch by primary key | `SELECT * FROM <table> WHERE <pk> = <random_existing_id>` |
| `--full-scan` | Sequential scan throughput | `SELECT count(*) FROM <largest_table>` |
| `--inner-join` | Join performance between two related tables | `SELECT ... FROM <parent> INNER JOIN <child> ON <fk> LIMIT 1000` |
| `--aggregate` | GROUP BY + aggregation | `SELECT <col>, count(*), avg(<numeric_col>) FROM <table> GROUP BY <col>` |
| `--write-insert` | Insert throughput | `INSERT INTO <bench_temp_table> VALUES (...)` (uses a temporary table) |
| `--write-update` | Update throughput | `UPDATE <bench_temp_table> SET <col> = <val> WHERE <pk> = <id>` |
| `--concurrent` | Connection pool saturation | Runs `--point-lookup` across N concurrent connections (default: pool max) |
| `--cold-start` | First-query latency after fresh connection | Disconnects, reconnects, runs query — measures total including connect time |

The `--suite standard` flag runs all read benchmarks in sequence and produces a combined report.

### How templates work

```
mdb bench prod --inner-join --runs 50
  → Introspect schema: find tables with foreign key relationships
  → Pick the best candidate pair (prefer tables with >1K rows)
  → Generate dialect-specific JOIN query
  → Warm up: run query 3 times (discarded)
  → Execute 50 measured runs, collecting per-run timing
  → Output: min, max, mean, median, p95, p99, stddev
```

For `--write-*` benchmarks, a temporary table is created before the run and dropped after.
No production data is modified.

### Output

```
Benchmark: inner-join × 50 runs @ 10s interval
Connection: prod (postgresql)
Query: SELECT o.id, u.name FROM orders o INNER JOIN users u ON o.user_id = u.id LIMIT 1000

  Metric         Value
  ─────────────  ──────────
  Min            12.3ms
  Max            48.7ms
  Mean           18.4ms
  Median         16.1ms
  p95            32.5ms
  p99            45.2ms
  Std Dev        7.8ms
  Total rows     50,000

  Distribution:
  <10ms   ████░░░░░░░░░░░░░░░░  12%
  10-20ms ████████████████░░░░  64%
  20-30ms ████████░░░░░░░░░░░░  16%
  30-40ms ██░░░░░░░░░░░░░░░░░░   6%
  >40ms   █░░░░░░░░░░░░░░░░░░░   2%
```

### Comparison mode

```bash
mdb bench prod staging --inner-join --runs 50 --compare
```

Side-by-side output showing both connections' percentiles and a delta column
highlighting regressions or improvements.

### Programmatic API

```typescript
import { bench } from '@maitredb/core'

const result = await bench(conn, {
  query: 'SELECT * FROM orders WHERE status = $1',
  params: ['shipped'],
  runs: 100,
  intervalMs: 1000,
  warmupRuns: 3,
})

result.min    // 12.3
result.max    // 48.7
result.mean   // 18.4
result.median // 16.1
result.p95    // 32.5
result.p99    // 45.2
result.stddev // 7.8
result.histogram // [{ bucket: '<10ms', count: 6 }, ...]
```

---

## Agent Governance & Security Model

This is a **day-1 architectural concern**, not a bolt-on. Agents are powerful but need hard guardrails.

The governance layer exists to prevent the scenario from the Cursor database deletion incident: an unchecked LLM agent drops production databases because nothing stopped it. Maître d'B makes this impossible through **three-layer defense**:

1. **Query classification** — Parse SQL to understand intent (DDL, DML, read, write)
2. **Policy enforcement** — Conservative operation blocking + schema isolation
3. **Audit trail** — Complete queryable log of all attempted operations, blocked or not

### Threat Model: Agent Gone Rogue

An agent (LLM code generator, automation tool, etc.) can:
- Issue malicious queries (DROP DATABASE, DELETE *, TRUNCATE)
- Attempt privilege escalation (ALTER ROLE, GRANT admin)
- Exfiltrate data (SELECT * from PII tables, export to S3)
- Cause denial of service (resource exhaustion, infinite loops)
- Chain multiple operations (e.g., disable backup triggers before DROP)

Maître d'B's response: **fail safely and noisily**. Block the dangerous operation, log the attempt, return a clear error with context so the human can investigate.

### Policy file: `~/.maitredb/policies.json`

```jsonc
{
  "policies": {
    "agent-default": {
      "mode": "read-only",                    // read-only | read-write | full
      
      // Data volume safeguards
      "maxRowsPerQuery": 10000,               // hard limit on result size
      "maxQueriesPerMinute": 60,              // rate limiting
      "maxConcurrentQueries": 5,
      "sessionTimeoutMs": 300000,             // 5 min idle timeout
      
      // Schema isolation
      "allowedSchemas": ["public", "analytics"],  // only these schemas
      "allowedTables": null,                      // null = all in allowedSchemas, else: ["users", "orders"]
      "forbiddenPatterns": [                      // table name regexes to block
        "^admin_.*",
        "^system_.*",
        ".*_secret",
        ".*_key"
      ],
      
      // Destructive operation blocking (Conservative mode)
      // Each operation type can be individually controlled
      "operations": {
        "read": { "allowed": true },              // SELECT, WITH, etc.
        "insert": { "allowed": true },            // INSERT
        "update": { "allowed": false },           // UPDATE (blocked by default for agents)
        "delete": { 
          "allowed": false,                       // DELETE is blocked
          "allowIfHasWhereClause": false          // even DELETE WHERE id = 123 is blocked
        },
        "truncate": { "allowed": false },         // TRUNCATE (always destructive)
        "drop": { "allowed": false },             // DROP TABLE/DATABASE/SCHEMA/INDEX (always destructive)
        "alter": { 
          "allowed": false,                       // ALTER TABLE/DATABASE
          "allowedAlterations": []                // future: granular ALTER control
        },
        "ddl": { "allowed": false },              // CREATE (database-level changes)
        "transaction": { 
          "allowed": true,
          "allowCommit": false,                   // Agent can BEGIN, but cannot COMMIT (human must)
          "allowRollback": true                   // Agent can ROLLBACK
        },
        "vacuum": { "allowed": false },           // VACUUM, OPTIMIZE
        "grant": { "allowed": false },            // GRANT, REVOKE (privilege changes)
        "procedure": { "allowed": false },        // CALL, CREATE PROCEDURE
        "import": { "allowed": false },           // COPY FROM, LOAD DATA (data injection)
        "export": { 
          "allowed": false,                       // SELECT INTO, UNLOAD, S3 export
          "allowedFormats": []
        }
      },
      
      // Expensive query safeguards
      "requireExplainBefore": {
        "rowEstimateThreshold": 1000000,          // must EXPLAIN before running expensive queries
        "joinCountThreshold": 5,                  // warn on joins > 5 tables
        "subqueryDepthThreshold": 3               // warn on nested subqueries > 3 deep
      },
      
      // Audit & approval
      "auditAllOperations": true,                 // log everything to history.db
      "requireApprovalFor": [                     // operations requiring human sign-off
        "UPDATE",
        "DELETE"
      ],
      "approvalTimeout": 3600000,                 // 1 hour: approval token expires after this
      "blockedReasonMessage": "Destructive operations are not allowed for agents. Contact your database administrator to perform this operation."
    },
    
    "human-default": {
      "mode": "full",
      "maxRowsPerQuery": null,
      "maxQueriesPerMinute": null,
      "auditAllOperations": false,                // humans not micro-managed
      "operations": {
        "read": { "allowed": true },
        "insert": { "allowed": true },
        "update": { "allowed": true },
        "delete": { "allowed": true },
        "truncate": { "allowed": true },
        "drop": { "allowed": true },
        "alter": { "allowed": true },
        "ddl": { "allowed": true },
        "transaction": { "allowed": true, "allowCommit": true },
        "vacuum": { "allowed": true },
        "grant": { "allowed": true },
        "procedure": { "allowed": true },
        "import": { "allowed": true },
        "export": { "allowed": true }
      }
    },
    
    "agent-prod": {
      // Strictest policy for production agent access
      // Extends agent-default with even tighter controls
      "mode": "read-only",
      "maxRowsPerQuery": 5000,
      "allowedSchemas": ["analytics"],
      "auditAllOperations": true,
      "operations": {
        "read": { "allowed": true },
        "insert": { "allowed": false },
        "update": { "allowed": false },
        "delete": { "allowed": false },
        "truncate": { "allowed": false },
        "drop": { "allowed": false },
        "alter": { "allowed": false },
        "ddl": { "allowed": false },
        "transaction": { "allowed": false },
        "vacuum": { "allowed": false },
        "grant": { "allowed": false },
        "procedure": { "allowed": false },
        "import": { "allowed": false },
        "export": { "allowed": false }
      }
    }
  },
  
  "connectionPolicies": {
    "prod": "agent-prod",                         // prod gets strictest policy
    "staging": "agent-default",
    "dev": "human-default"                        // dev is wide open
  }
}
```

### Query Classification & Validation

Before execution, the governance layer parses and classifies every query:

```typescript
interface QueryClassification {
  type: 'read' | 'write' | 'ddl' | 'dcl' | 'transaction';
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DROP' | 'ALTER' | 'TRUNCATE' | ...;
  affectedSchemas: string[];
  affectedTables: string[];
  rowEstimate?: number;              // from EXPLAIN if available
  hasWhereClause: boolean;
  hasLimitClause: boolean;
  joinCount: number;
  subqueryDepth: number;
  wouldModifyTables: boolean;
  isSensitiveOperation: boolean;     // DROP, TRUNCATE, GRANT, VACUUM, etc.
}
```

### Query Validation Pipeline

```
Agent submits query
  ↓
Parse query with SQL parser (e.g., pgsql-parser or dialect-specific)
  ↓
Classify operation (SELECT? UPDATE? DROP DATABASE?)
  ↓
Check policy constraints:
  ├─ Is this operation type allowed? (operations.{type}.allowed)
  ├─ Are target schemas in allowedSchemas list?
  ├─ Do target tables match forbiddenPatterns regex?
  ├─ If DELETE: does it have WHERE clause? (allowIfHasWhereClause check)
  ├─ If EXPLAIN required: run EXPLAIN, compare row estimate vs threshold
  ├─ Check rate limits (queries per minute, concurrent queries)
  └─ Check data volume limits (maxRowsPerQuery)
  ↓
If blocked → return GovernanceError(code: 3005, message, suggestion)
If approved → execute via driver
If requireApprovalFor → require agent to call approveOperation(token)
  ↓
Log to audit trail (operation, user, policy applied, result)
```

### How Policies Are Applied

- CLI flag `--as agent` activates the named agent policy for that session (default: agent-default)
- `--policy custom-name` overrides to use a different policy
- MCP server mode always uses the configured agent policy (no escape hatch)
- Policies are enforced in `@maitredb/governance` before queries reach the driver
- Policy violations return `GovernanceError` with code `3005` (`OPERATION_BLOCKED`)

### Approval Workflow (for requireApprovalFor Operations)

For operations marked in `requireApprovalFor` (e.g., UPDATE, DELETE on production), agents can:

1. **Prepare** the operation without executing:
   ```bash
   mdb query prod "UPDATE users SET status = 'inactive'" --as agent --dry-run
   # Returns: operation ID, query hash, summary
   # Output: "Operation prepared (ID: op-abc123). Call 'mdb query prod --approve op-abc123' to execute."
   ```

2. **Request approval** (in agent flow, this is a prompt to the human orchestrator):
   ```json
   {
     "operationId": "op-abc123",
     "query": "UPDATE users SET status = 'inactive'",
     "rowEstimate": 5234,
     "policy": "agent-default",
     "blockedReason": "UPDATE operations require human approval",
     "approvalToken": "token-xyz789"
   }
   ```

3. **Execute with approval token** (human provides token back to orchestrator):
   ```bash
   mdb query prod "UPDATE users SET status = 'inactive'" --as agent --approval-token token-xyz789
   # Validates token not expired, then executes
   ```

### Conservative Blocking Example: The Cursor Incident

This scenario should be **impossible** with maitredb's agent policy:

```typescript
// Agent thinks it's being helpful and cleans up
const query = "DROP DATABASE production_backup";

// With maitredb --as agent using agent-default policy:
// 1. Parser: "DROP DATABASE" identified
// 2. Classification: operation = 'drop', type = 'ddl'
// 3. Policy check: operations.drop.allowed === false
// 4. Result: BLOCKED
// 5. Error returned:
{
  error: "OPERATION_BLOCKED",
  code: 3005,
  message: "DROP operations are not allowed for agents",
  suggestion: "If you need to drop a database, connect as a human (without --as agent flag)",
  operation: "DROP DATABASE",
  blockedReason: "Destructive operations are not allowed for agents"
}

// Agent cannot proceed. No database is dropped. Incident prevented.
```

### Audit Trail & Forensics

Every attempt is logged to `~/.maitredb/history.db` (SQLite):

```sql
-- history.db schema
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  connection TEXT NOT NULL,
  agent_id TEXT,                    -- NULL for humans
  query TEXT NOT NULL,
  classification_type TEXT,         -- read|write|ddl|...
  operation TEXT,                   -- SELECT|UPDATE|DROP|...
  policy_name TEXT,
  allowed BOOLEAN,
  blocked_reason TEXT,              -- If blocked, why
  error_code INTEGER,
  row_estimate INTEGER,
  execution_ms INTEGER,
  affected_rows INTEGER
);

-- Forensics: "What did agent X do today?"
SELECT * FROM audit_log 
WHERE agent_id = 'claude-cursor-v1' 
  AND timestamp > datetime('now', '-1 day') 
ORDER BY timestamp DESC;

-- "What operations were blocked?"
SELECT * FROM audit_log 
WHERE allowed = FALSE 
ORDER BY timestamp DESC 
LIMIT 20;
```

### Maitredb as a Safety Layer for AI Coding Tools

Cursor and other AI coding agents using Claude can now integrate maitredb:

```bash
# In agent's execution environment, instead of:
# > psql -h prod.db.example.com -d mydb -c "DROP DATABASE ..."

# The agent uses maitredb (with --as agent flag):
# > mdb query prod "DROP DATABASE ..." --as agent
# Result: OPERATION_BLOCKED + clear error message

# The agent logs it, reports to human:
# "I attempted to drop the database but was blocked by safety policy. 
#  To proceed, run this command yourself with approval."
```

This turns a **silent disaster** into a **clear workflow** where humans stay in control.

### Governance Package Implementation (`@maitredb/governance`)

The governance layer is **mandatory middleware** — all queries pass through it.

**Core components:**

1. **QueryClassifier**
   - Parses SQL to identify operation type (read, write, ddl, transaction, etc.)
   - Uses dialect-aware parsers (postgres-parser, sql-bricks, etc.) or generic SQL regex for simple classification
   - Returns `QueryClassification` with operation, affected schemas/tables, complexity metrics
   - Caches parser for a given dialect

2. **PolicyEngine**
   - Loads policy JSON from `~/.maitredb/policies.json` with full validation
   - Implements policy matching: query → connection → dialect → policy name
   - Validates query against policy:
     - Operation type allowed? (operations.{type}.allowed)
     - Affected schemas in allowlist? (allowedSchemas array)
     - Affected tables don't match forbidden patterns? (forbiddenPatterns regex)
     - For DELETE: has WHERE clause? (allowIfHasWhereClause)
     - Rate limits respected? (maxQueriesPerMinute, concurrent queries)
     - Row limits respected? (maxRowsPerQuery)
   - Returns `PolicyDecision` with allowed/blocked status + reason

3. **AuditLogger**
   - Writes every operation attempt to `~/.maitredb/history.db` SQLite database
   - Captures: timestamp, connection, query, classification, policy, result, error
   - Queryable for forensics: "What did agent X attempt?", "Which operations were blocked?"
   - Retention: configurable (default: unlimited, but recommend monthly rotation)

4. **ApprovalManager** (for requireApprovalFor operations)
   - Generates approval tokens with expiration (1 hour default)
   - Validates token before execution
   - Tracks which operations have been approved
   - Prevents replay attacks (token can only be used once)

**Flow:**

```typescript
interface GovernanceMiddleware {
  validateAndExecute(
    query: string,
    connection: Connection,
    policy: GovernancePolicy,
    agentId?: string
  ): Promise<QueryResult> {
    // 1. Classify
    const classification = queryClassifier.classify(query, connection.dialect);
    
    // 2. Validate against policy
    const decision = policyEngine.evaluate(classification, policy);
    
    // 3. Log attempt
    auditLogger.log({
      query,
      classification,
      allowed: decision.allowed,
      policy: policy.name,
      agentId
    });
    
    // 4. If blocked: return error
    if (!decision.allowed) {
      throw new MaitreError(
        MaitreErrorCode.OPERATION_BLOCKED,
        decision.blockedReason,
        connection.dialect,
        undefined,
        decision.suggestion
      );
    }
    
    // 5. If requires approval: check token
    if (decision.requiresApproval && !approvalToken) {
      throw new MaitreError(
        MaitreErrorCode.OPERATION_BLOCKED,
        `Operation ${classification.operation} requires approval`,
        connection.dialect,
        undefined,
        `Run with --approval-token <token>`
      );
    }
    
    // 6. Execute
    return queryExecutor.execute(query, connection);
  }
}
```

**Policy loading & validation:**

```typescript
interface GovernancePolicyFile {
  policies: Record<string, GovernancePolicy>;
  connectionPolicies: Record<string, string>;  // connection name → policy name
}

// Validation on load:
// - All referenced policies exist (no dangling connectionPolicies references)
// - All operation types are recognized
// - forbiddenPatterns are valid regex
// - Numeric constraints are positive (maxRowsPerQuery > 0)
// - Schema/table allowlists don't overlap with blockedSchemas/forbiddenPatterns
```

---

## Error Taxonomy

Unified error codes across all 11 databases. Defined on day 1, never changed.

```typescript
export enum MaitreErrorCode {
  // Connection errors (1xxx)
  CONNECTION_FAILED       = 1001,
  CONNECTION_TIMEOUT      = 1002,
  AUTHENTICATION_FAILED   = 1003,
  CONNECTION_LOST         = 1004,
  SSL_ERROR               = 1005,
  TUNNEL_FAILED           = 1006,
  POOL_EXHAUSTED          = 1007,

  // Query errors (2xxx)
  SYNTAX_ERROR            = 2001,
  EXECUTION_ERROR         = 2002,
  QUERY_TIMEOUT           = 2003,
  QUERY_CANCELLED         = 2004,
  RESULT_TOO_LARGE        = 2005,
  PERMISSION_DENIED       = 2006,
  RELATION_NOT_FOUND      = 2007,

  // Governance errors (3xxx)
  POLICY_VIOLATION        = 3001,
  READ_ONLY_VIOLATION     = 3002,
  RATE_LIMITED             = 3003,
  SCHEMA_NOT_ALLOWED      = 3004,
  OPERATION_BLOCKED       = 3005,
  EXPLAIN_REQUIRED        = 3006,

  // Transaction errors (4xxx)
  TRANSACTION_FAILED      = 4001,
  DEADLOCK                = 4002,
  SERIALIZATION_FAILURE   = 4003,

  // System errors (9xxx)
  DRIVER_NOT_FOUND        = 9001,
  PLUGIN_LOAD_FAILED      = 9002,
  CACHE_ERROR             = 9003,
  INTERNAL_ERROR          = 9999,
}

export class MaitreError extends Error {
  constructor(
    public readonly code: MaitreErrorCode,
    message: string,
    public readonly dialect?: DatabaseDialect,
    public readonly nativeCode?: string | number, // original DB error code
    public readonly suggestion?: string,          // actionable guidance
  ) { super(message); }

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
```

CLI outputs errors as JSON on stderr. Exit codes: 0 = success, 1 = user/query error, 2 = governance violation, 3 = system error.

---

## Configuration Hierarchy

Clear precedence, defined once, never ambiguous:

```
CLI flags (highest)
  → Environment variables (MDB_*)
    → Project config (./.maitredb/config.json)
      → User config (~/.maitredb/config.json)
        → Built-in defaults (lowest)
```

### Project-level config

A `.maitredb/` directory in a project root allows teams to share:
- Connection definitions (without secrets)
- Default output formats
- Policy overrides for that project
- Custom query templates / saved queries

This is `.gitignore`-safe by default for credentials but committable for connection shapes.

### Environment variables

All config is overridable via `MDB_*` env vars:

```bash
MDB_DEFAULT_FORMAT=json
MDB_DEFAULT_CONNECTION=prod
MDB_MAX_ROWS=5000
MDB_CONN_PROD_HOST=db.example.com
MDB_CONN_PROD_PASSWORD=***          # opt-in, not recommended
```

---

## Transaction Model

Transactions in a CLI need session persistence. Two modes:

### Inline (single command)

```bash
mdb transaction prod --begin \
  "INSERT INTO orders (id, total) VALUES (1, 99.99)" \
  "UPDATE inventory SET stock = stock - 1 WHERE item_id = 42" \
  --commit
```

Executes all statements in a single transaction. Any failure triggers rollback.

### Interactive session

```bash
mdb session prod
# Opens a persistent REPL-like session
mdb> BEGIN;
mdb> INSERT INTO orders ...;
mdb> SELECT * FROM orders WHERE id = 1;
mdb> COMMIT;
mdb> \q
```

Session state (transaction, connection, search_path/schema) persists across commands within the session.

### For agents (structured)

```bash
echo '{"statements": ["INSERT ...", "UPDATE ..."], "mode": "transaction"}' \
  | mdb query prod --stdin --format json
```

Agents submit transaction batches as JSON. Atomic: all succeed or all roll back.

---

## Timezone & Type Handling

Timezone and type mismatches across databases are a notorious source of bugs. Policy decisions made once, consistently.

### Timezone rules

1. **All timestamps returned in UTC** by default. The driver normalizes to ISO 8601 with `Z` suffix.
2. `--timezone local` flag returns timestamps in the host's local timezone.
3. `--timezone <tz>` flag returns timestamps in a specific timezone (e.g., `America/New_York`).
4. The original database timezone-awareness is preserved in metadata (`hasTimezone: true/false`).

### Unified type system

```typescript
export type MaitreType =
  | 'string' | 'number' | 'integer' | 'float' | 'decimal'
  | 'boolean'
  | 'date' | 'time' | 'datetime' | 'timestamp'
  | 'json' | 'array'
  | 'binary' | 'uuid'
  | 'interval' | 'geometry' | 'unknown';
```

Each driver maps native types to `MaitreType`. The original native type string is always preserved alongside the normalized type so no information is lost.

### Binary/LOB handling

- CLI: Binary values are base64-encoded by default. `--binary hex` for hex encoding. `--binary skip` to omit binary columns.
- Large objects: Streamed to file with `--output-file` rather than buffered to stdout.
- GUI: Binary columns show size + type indicator, with download option.

---

## Middleware & Hook System

Pre/post query hooks enable logging, transformation, and custom validation without modifying core:

```typescript
export interface QueryHook {
  name: string;
  phase: 'before' | 'after' | 'error';
  handler(context: HookContext): Promise<HookResult>;
}

export interface HookContext {
  connection: ConnectionInfo;
  query: string;
  params?: unknown[];
  result?: QueryResult;      // only in 'after' phase
  error?: MaitreError;       // only in 'error' phase
  metadata: {
    caller: 'human' | 'agent' | 'programmatic';
    timestamp: Date;
    queryId: string;
  };
}
```

### Built-in hooks

- **Audit logger**: Records all queries to `~/.maitredb/audit.log` (configurable)
- **Slow query logger**: Logs queries exceeding a configurable threshold
- **Query transformer**: Applies `SET search_path`, statement timeouts, etc.

### User-defined hooks

Registered via config:

```jsonc
{
  "hooks": [
    {
      "name": "slack-on-ddl",
      "phase": "after",
      "match": { "queryType": "ddl", "connection": "prod" },
      "action": { "exec": "curl -X POST ..." }
    }
  ]
}
```

---

## CLI Command Surface

```bash
# Connections
mdb connect add <name> --type postgres --host ... --port ... --user ... --database ...
mdb connect add <name> --dsn "postgresql://..."
mdb connect test <name>
mdb connect list
mdb connect remove <name>

# Queries
mdb query <conn> "SQL"
mdb query <conn> --file ./report.sql
mdb query <conn> --stdin                    # pipe SQL via stdin
mdb query <conn> "SQL" --format json|table|csv|ndjson|yaml
mdb query <conn> "SQL" --stream             # streaming output, constant memory

# Schema introspection
mdb schema <conn> tables [--schema public]
mdb schema <conn> columns <table>
mdb schema <conn> functions
mdb schema <conn> procedures
mdb schema <conn> indexes <table>
mdb schema <conn> types

# Permissions
mdb permissions <conn> roles
mdb permissions <conn> grants [--role <role>]
mdb permissions <conn> table-grants <table>

# Tracing
mdb trace <conn> "SQL" [--analyze] [--format json|tree|text]

# Transactions
mdb transaction <conn> --begin "stmt1" "stmt2" --commit
mdb session <conn>                          # interactive REPL

# Schema comparison
mdb diff <conn1> <conn2> [--schema public]

# Cache management
mdb cache clear [--connection <name>]
mdb cache stats

# Agent / MCP
mdb mcp-server                              # start as MCP tool server
mdb query <conn> "SQL" --as agent           # apply agent governance policy

# Dump & export
mdb dump <conn> <table> --to iceberg --output ./warehouse/
mdb dump <conn> --schema public --to iceberg --output s3://bucket/
mdb dump <conn> <table> --to parquet --output ./export.parquet
mdb dump <conn> --schema public --to sql --dialect postgresql
mdb dump <conn> <table> --to iceberg --mask --faker-fill  # masked export
mdb load <conn> --from iceberg --input ./warehouse/users --create-table
mdb copy <src>.<table> → <tgt>.<table> [--mask]
mdb inspect ./warehouse/users --format iceberg

# Data masking
mdb masking scan <conn> --schema public     # auto-detect columns needing masking
mdb masking preview <conn> <table>          # show what masking would do
mdb query <conn> "SQL" --mask "email:partial,ssn:redact"  # inline one-off masking

# Data bootstrapping
mdb faker seed <conn> <table> --count 1000  # seed table with auto-detected fake data
mdb faker seed <conn> --schema public --count 1000  # seed entire schema (FK-aware)
mdb faker preview <conn> <table> --count 5  # dry run
mdb faker inspect <conn> <table>            # show inferred generators
mdb faker clean <conn> --schema public      # truncate in reverse FK order
mdb faker export <conn> <table> --count 1000 --format sql  # generate to file

# Optimization recommendations
mdb optimize <conn> [--schema public] [--tables users,orders]
mdb optimize <conn> --focus indexes|queries|storage|config
mdb optimize <conn> --format json

# Benchmarking
mdb bench <conn> "SQL" --runs 100 --interval 1s
mdb bench <conn> --inner-join --runs 50 --interval 10s
mdb bench <conn> --aggregate --runs 100
mdb bench <conn> --full-scan --runs 20
mdb bench <conn> --point-lookup --runs 500 --interval 100ms
mdb bench <conn> --write-insert --runs 100
mdb bench <conn> --suite standard --runs 50
mdb bench <conn1> <conn2> --inner-join --runs 50 --compare

# History
mdb history [--connection <name>] [--last 20]

# Meta
mdb --version
mdb --help
```

### Output format details

| Format | Flag | Use case |
|---|---|---|
| Aligned table | `--format table` (default TTY) | Human reading in terminal |
| JSON | `--format json` | Programmatic consumption, full result |
| NDJSON | `--format ndjson` | Streaming to agents/pipes, one JSON object per row |
| CSV | `--format csv` | Spreadsheet export, data pipelines |
| YAML | `--format yaml` | Config-style readability |
| Raw | `--format raw` | Tab-separated, no headers, for `awk`/`cut` |

Auto-detection: if stdout is a TTY, default to `table`. If piped, default to `ndjson`.

---

## Programmatic API

Beyond the CLI binary, `@maitredb/core` is importable as a library:

```typescript
import { Maitre } from '@maitredb/core'

const mdb = new Maitre()

// Uses saved connection config + credential store
const conn = await mdb.connect('prod')

// Schema introspection (cached)
const tables = await mdb.schema.tables(conn, 'public')
const columns = await mdb.schema.columns(conn, 'public', 'users')

// Query execution
const result = await mdb.query(conn, 'SELECT * FROM users WHERE active = $1', [true])

// Streaming
for await (const row of mdb.stream(conn, 'SELECT * FROM events')) {
  process.stdout.write(JSON.stringify(row) + '\n')
}

// Transactions
const tx = await mdb.beginTransaction(conn)
await tx.query('INSERT INTO ...')
await tx.query('UPDATE ...')
await tx.commit() // or tx.rollback()

// Explain
const plan = await mdb.explain(conn, 'SELECT * FROM orders WHERE total > 100', { analyze: true })

await mdb.disconnect(conn)
```

This lets agent tooling scripts, CI pipelines, and custom apps get the full driver abstraction, caching, and credential isolation without building any of it.

---

## GUI (Tauri 2 + React)

Core runs as a **Node.js sidecar process** exposing a local WebSocket API. The Tauri frontend communicates with it. All database logic stays in TypeScript, shared with CLI.

### Key screens

1. **Connection Manager** — Add/edit/test/group connections. Visual status indicators.
2. **Query Editor** — Monaco-based, syntax highlighting per dialect, autocomplete from cached schema, multi-tab, query history sidebar.
3. **Results Viewer** — Paginated data grid (TanStack Table), column sorting/filtering, export. Virtual scrolling for large results.
4. **Schema Explorer** — Tree sidebar: Connection > Schema > Tables/Views/Functions/Procedures. Click for columns, indexes, DDL, row count estimates.
5. **Trace Profiler** — Visual query plan DAG (React Flow), color-coded by cost, expandable node details, side-by-side comparison.
6. **Permissions Viewer** — Role hierarchy tree + grant matrix (role x object x privilege).
7. **Diff View** — Side-by-side schema comparison between connections/environments.
8. **Audit Log Viewer** — Searchable query history with timing, caller, connection.

---

## Plugin System

Any npm package named `maitredb-plugin-*` that exports a `MaitrePlugin` object is auto-discovered:

```typescript
export interface MaitrePlugin {
  name: string;
  version: string;
  dialect: DatabaseDialect;
  driver: DriverAdapter;
  onRegister?(core: MaitreCore): void;
}
```

Discovery order:
1. Built-in drivers (the 11 bundled)
2. npm packages matching `maitredb-plugin-*` or `@*/maitredb-plugin-*`
3. Explicit entries in `~/.maitredb/config.json` `plugins` array

Enables third-party support for Oracle, SQL Server, CockroachDB, etc.

---

## Schema Diffing

Compare schemas across connections (e.g., prod vs staging):

```bash
mdb diff prod staging --schema public
```

Output:
- Tables added/removed/modified
- Column type changes, nullability changes
- Index differences
- Function/procedure signature changes

**Not** a migration tool — it reports differences. Pair with tools like `dbmate` or `flyway` for actual migrations.

---

## Query History & Audit Log

### What's captured

```typescript
export interface AuditEntry {
  id: string;
  timestamp: Date;
  connection: string;
  dialect: DatabaseDialect;
  caller: 'human' | 'agent' | 'programmatic';
  query: string;
  params?: unknown[];       // never logged for prod connections by default
  durationMs: number;
  rowsAffected?: number;
  rowsReturned?: number;
  error?: { code: MaitreErrorCode; message: string };
  policyApplied?: string;
}
```

### Storage

- `~/.maitredb/history.db` (SQLite) — rotated at configurable size (default 100MB)
- Param logging is **off by default** for connections tagged `production` (prevents PII leakage)
- `mdb history` command and GUI screen query this database

---

## Multi-Workspace & Team Support

### Project-level `.maitredb/`

A `.maitredb/` directory in a project root is detected automatically (like `.git/`):

```
my-project/
├── .maitredb/
│   ├── connections.json    # shared connection shapes (no secrets)
│   ├── policies.json       # project-specific governance
│   ├── queries/            # saved/shared queries
│   │   ├── daily-report.sql
│   │   └── user-audit.sql
│   └── config.json         # project defaults (format, schema, etc.)
```

This merges with `~/.maitredb/` — project config overrides user config, and credentials always come from the user's personal credential store.

### Team credential sharing (future)

A `credentialStore` config option could point to a shared vault:

```jsonc
{
  "credentialStore": {
    "type": "vault",           // hashicorp vault, aws secrets manager, etc.
    "address": "https://vault.internal:8200",
    "path": "secret/data/maitredb"
  }
}
```

This is a Phase 4+ feature but the credential resolution interface should be pluggable from day 1.

---

## Client-Side Data Masking

Most databases don't have Snowflake-style native masking policies. Maître d'B fills that gap
by enforcing masking **at the middleware layer** — after query results leave the database but
before they reach the customer (human, agent, or downstream pipe). This is critical for the
agent era: an LLM should never see raw PII even if the database role technically has access.

### Masking policy file

Defined per-connection in `.maitredb/masking.json` or `~/.maitredb/masking.json`:

```jsonc
{
  "masking": {
    "prod": {
      "defaults": {
        "callers": ["agent"],           // apply these rules to agents by default
        "action": "none"                // don't mask unless a rule matches
      },
      "rules": [
        {
          "name": "mask-emails",
          "match": {
            "columns": ["email", "*.email", "*.email_address"],
            "tags": ["pii.email"]       // or match by column tag/comment
          },
          "action": "mask",
          "strategy": "partial",        // j***@e***.com
          "applyTo": ["agent", "human-readonly"]
        },
        {
          "name": "redact-ssn",
          "match": {
            "columns": ["ssn", "*.ssn", "*.social_security*"],
            "pattern": "\\d{3}-\\d{2}-\\d{4}"   // or match by value pattern
          },
          "action": "redact",           // replaced with [REDACTED]
          "applyTo": ["agent", "human-readonly", "human"]
        },
        {
          "name": "hash-user-ids",
          "match": {
            "columns": ["user_id", "customer_id"],
            "context": ["joins", "where"] // only mask in result display, preserve in JOINs/WHEREs
          },
          "action": "hash",             // consistent hash — preserves referential integrity
          "algorithm": "sha256-truncated-8",
          "applyTo": ["agent"]
        },
        {
          "name": "nullify-tokens",
          "match": {
            "columns": ["api_key", "access_token", "refresh_token", "*.secret*"]
          },
          "action": "nullify",          // replaced with NULL
          "applyTo": ["agent", "human-readonly"]
        },
        {
          "name": "noise-financial",
          "match": {
            "columns": ["salary", "revenue", "account_balance"]
          },
          "action": "noise",            // add random ±10% noise
          "noisePercent": 10,
          "preserveDistribution": true,  // statistical shape preserved
          "applyTo": ["agent"]
        },
        {
          "name": "truncate-addresses",
          "match": { "columns": ["address", "street_address"] },
          "action": "generalize",       // "123 Main St, Apt 4" → "Main St area"
          "level": "street",            // street | city | state | country
          "applyTo": ["agent"]
        }
      ]
    }
  }
}
```

### Masking strategies

| Strategy | What it does | Use case |
|---|---|---|
| `partial` | Preserves structure, masks content: `j***@e***.com` | Emails, phone numbers — recognizable shape without real data |
| `redact` | Replaces with `[REDACTED]` | Secrets, SSNs — zero information leakage |
| `hash` | Consistent SHA-256 truncated hash | IDs — agents can still JOIN/GROUP BY hashed values |
| `nullify` | Replaces with `NULL` | Tokens, keys — column exists but has no value |
| `noise` | Adds configurable random noise (±N%) | Financial data — statistical analysis still works, exact values hidden |
| `generalize` | Reduces precision: full address → city-level | Addresses, dates (day → month), ages (exact → range) |
| `synthetic` | Replaces with faker-generated equivalent | Names, emails — realistic but fake (ties into `@maitredb/faker`) |
| `none` | Pass-through, no masking | Explicitly un-masked columns |

### How it works architecturally

```
Query results from driver (raw rows)
  → Streaming through masking transform (in @maitredb/governance)
    → For each row, for each column:
      → Match column name/tag against masking rules
      → Apply strategy based on caller type (agent/human/programmatic)
      → Emit masked row downstream
  → Reaches CLI output / GUI display / programmatic consumer
```

Key design points:
- **Streaming-compatible**: Masking is a transform on the row stream, not a post-processing buffer step. Works with the streaming-first architecture.
- **Caller-aware**: Different callers get different masking levels. A human DBA sees real data; an agent sees masked data; a read-only dashboard sees partially masked data.
- **Consistent hashing**: Hash-based masking uses a per-connection salt (stored in credential store). The same input always produces the same hash within a session, so JOINs on hashed IDs still work.
- **Column auto-detection**: Optional heuristic mode that scans column names and sample values to suggest masking rules. Uses pattern matching (email regex, SSN format, credit card Luhn check) to flag columns that probably need masking.
- **Audit integration**: Masked columns are logged in the audit trail so there's a record of what was hidden from whom.

### CLI usage

```bash
# Query with masking applied (uses connection's masking policy)
mdb query prod "SELECT * FROM users" --as agent

# Preview what masking would do without executing
mdb masking preview prod users

# Auto-detect columns that likely need masking
mdb masking scan prod --schema public
# Output:
# ⚠ users.email        → matches pattern: email       → suggest: partial
# ⚠ users.ssn          → matches pattern: ssn         → suggest: redact
# ⚠ payments.card_last4 → matches pattern: card_number → suggest: redact
# ✓ users.name         → no PII pattern detected
# ...

# Apply a masking rule inline (one-off, not saved)
mdb query prod "SELECT * FROM users" --mask "email:partial,ssn:redact"
```

### GUI integration

- **Masking indicator**: Masked columns show a shield icon in the results grid. Hover for the strategy applied.
- **Masking policy editor**: Visual rule builder in the GUI for creating/editing masking rules.
- **Toggle masking**: Human users with appropriate permissions can toggle masking on/off per column in the results viewer (with audit log entry).

---

## Data Bootstrapping (Faker)

A built-in data generation utility for seeding test databases, sandboxes, and development environments with realistic fake data. Like Python's `faker` but integrated into the database client — it knows your schema and generates data that actually fits.

### Package: `@maitredb/faker`

```typescript
import { MaitreFaker } from '@maitredb/faker'

const faker = new MaitreFaker({ locale: 'en_US', seed: 42 }) // deterministic with seed

// Generate rows based on a schema definition
const users = faker.generate('users', {
  count: 1000,
  columns: {
    id:         { type: 'uuid' },
    name:       { type: 'person.fullName' },
    email:      { type: 'internet.email', unique: true },
    phone:      { type: 'phone.number', format: '+1##########' },
    address:    { type: 'location.streetAddress' },
    city:       { type: 'location.city' },
    state:      { type: 'location.stateAbbr' },
    zip:        { type: 'location.zipCode' },
    created_at: { type: 'date.recent', days: 365 },
    status:     { type: 'helpers.arrayElement', values: ['active', 'inactive', 'suspended'] },
    salary:     { type: 'finance.amount', min: 30000, max: 200000, decimals: 2 },
  }
})
```

### Schema-aware auto-generation

The killer feature: **point it at a real table and it infers what fake data to generate**.

```bash
# Analyze table schema and generate matching fake data
mdb faker seed dev users --count 1000

# What happens internally:
# 1. Introspects users table → columns, types, constraints, foreign keys
# 2. Maps each column to a faker generator:
#    - "email" varchar(255) NOT NULL UNIQUE → internet.email (unique: true)
#    - "name" varchar(100)                  → person.fullName
#    - "created_at" timestamptz             → date.recent
#    - "status" varchar(20) CHECK (...)     → helpers.arrayElement (from CHECK constraint values)
#    - "department_id" int REFERENCES ...   → picks from existing department_id values (FK-aware)
# 3. Generates 1000 rows respecting:
#    - NOT NULL constraints
#    - UNIQUE constraints (deduplication)
#    - CHECK constraints (value ranges/enums)
#    - Foreign key references (uses existing parent rows)
#    - Column types and sizes
# 4. Inserts via batch INSERT with configurable batch size
```

### Column-to-generator mapping heuristics

| Column pattern | Inferred generator |
|---|---|
| `*email*` | `internet.email` |
| `*name*`, `*first_name*`, `*last_name*` | `person.firstName`, `person.lastName`, `person.fullName` |
| `*phone*`, `*mobile*` | `phone.number` |
| `*address*`, `*street*` | `location.streetAddress` |
| `*city*` | `location.city` |
| `*state*` | `location.state` |
| `*zip*`, `*postal*` | `location.zipCode` |
| `*country*` | `location.country` |
| `*url*`, `*website*` | `internet.url` |
| `*avatar*`, `*image*` | `image.avatar` |
| `*price*`, `*amount*`, `*cost*` | `finance.amount` |
| `*description*`, `*bio*`, `*about*` | `lorem.paragraph` |
| `*company*`, `*organization*` | `company.name` |
| `*title*`, `*job_title*` | `person.jobTitle` |
| `*uuid*`, `*guid*` | `string.uuid` |
| `*token*`, `*api_key*` | `string.alphanumeric(64)` |
| `*ip*`, `*ip_address*` | `internet.ip` |
| `*color*` | `color.human` |
| `*latitude*` / `*longitude*` | `location.latitude` / `location.longitude` |
| `*created*`, `*updated*`, `*_at` | `date.recent` |
| `BOOLEAN` / `bool` type | `datatype.boolean` |
| `INTEGER` type (no heuristic match) | `number.int` with range from type size |
| `ENUM` type / CHECK constraint | `helpers.arrayElement` with constraint values |
| FK reference | Random selection from referenced table's existing rows |

### Override file: `.maitredb/faker.json`

For when heuristics aren't enough:

```jsonc
{
  "tables": {
    "users": {
      "count": 1000,
      "overrides": {
        "username": { "type": "internet.username", "unique": true },
        "role":     { "type": "helpers.weightedArrayElement",
                      "values": [
                        { "value": "user", "weight": 80 },
                        { "value": "admin", "weight": 15 },
                        { "value": "superadmin", "weight": 5 }
                      ]
                    },
        "avatar_url": { "type": "template", "template": "https://avatars.example.com/{{internet.username}}.png" }
      },
      "relations": {
        // Seed order: departments first, then users (respects FK dependencies)
        "depends_on": ["departments"]
      }
    },
    "orders": {
      "count": 5000,
      "overrides": {
        "user_id":    { "type": "ref", "table": "users", "column": "id" },
        "total":      { "type": "finance.amount", "min": 9.99, "max": 999.99 },
        "status":     { "type": "helpers.arrayElement", "values": ["pending", "shipped", "delivered", "cancelled"] },
        "ordered_at": { "type": "date.between", "from": "2024-01-01", "to": "2026-04-07" }
      }
    }
  },
  "seedOrder": ["departments", "users", "orders", "order_items"]
}
```

### Multi-table dependency resolution

Faker automatically resolves the correct insertion order from foreign key relationships:

```bash
# Seed an entire schema — auto-resolves dependency graph
mdb faker seed dev --schema public --count 1000

# What happens:
# 1. Introspects all tables in public schema
# 2. Builds FK dependency graph
# 3. Topological sort → determines insert order
# 4. Seeds tables in order: parents first, children after
# 5. Children reference actually-inserted parent IDs
```

### CLI commands

```bash
# Seed a single table with auto-detected fake data
mdb faker seed <conn> <table> --count 1000

# Seed entire schema (respects FK ordering)
mdb faker seed <conn> --schema public --count 1000

# Preview generated data without inserting (dry run)
mdb faker preview <conn> <table> --count 5

# Show the inferred column-to-generator mapping
mdb faker inspect <conn> <table>
# Output:
# Column         Type          Generator              Reason
# ─────────────  ────────────  ─────────────────────  ──────────────────
# id             uuid          string.uuid            type: uuid
# email          varchar(255)  internet.email         name match: *email*
# name           varchar(100)  person.fullName        name match: *name*
# department_id  int4          ref(departments.id)    foreign key
# status         varchar(20)   arrayElement(active…)  CHECK constraint
# created_at     timestamptz   date.recent(365d)      name match: *_at

# Seed using override file
mdb faker seed <conn> --config .maitredb/faker.json

# Clean seeded data (truncate tables in reverse dependency order)
mdb faker clean <conn> --schema public

# Generate to file instead of inserting (for review or version control)
mdb faker export <conn> <table> --count 1000 --format sql > seed.sql
mdb faker export <conn> <table> --count 1000 --format csv > seed.csv
```

### Locale support

```bash
mdb faker seed dev users --count 1000 --locale ja_JP
# Generates Japanese names, addresses, phone numbers, etc.
```

Supported locales inherited from the underlying faker library (50+ locales).

### Deterministic seeding

```bash
# Same seed → same data every time (reproducible test fixtures)
mdb faker seed dev users --count 100 --seed 42
```

Critical for CI: test fixtures must be deterministic so tests are reproducible.

### Ties into masking (bidirectional)

The `synthetic` masking strategy uses `@maitredb/faker` under the hood:

```jsonc
{
  "name": "anonymize-names",
  "match": { "columns": ["name", "first_name", "last_name"] },
  "action": "synthetic",           // replace real names with faker-generated names
  "fakerType": "person.fullName",
  "consistent": true,              // same input name → same fake name (per session)
  "applyTo": ["agent"]
}
```

This creates a full pipeline: real data goes through masking on read, and realistic fake data can be generated on write — both using the same underlying engine.

---

## Universal Dump & Iceberg Export

Every database has its own proprietary dump tool (`pg_dump`, `mysqldump`, `mongodump`,
`bcp`, `snowsql --export`, etc.). None of them produce a portable format. If you dump from
MySQL, only MySQL can read it back. Your data is locked in.

Maître d'B solves this with a **universal dump** that extracts from any supported database
and writes to **open formats** — with Apache Iceberg as the crown jewel.

### The pitch

```bash
# Dump a Postgres table to Iceberg format
mdb dump prod users --to iceberg --output ./warehouse/users

# Dump an entire MySQL schema to Iceberg
mdb dump prod --schema public --to iceberg --output ./warehouse/

# Now ANY engine can read it:
# - DuckDB:    SELECT * FROM iceberg_scan('./warehouse/users')
# - Spark:     spark.read.format("iceberg").load("./warehouse/users")
# - Trino:     SELECT * FROM iceberg.warehouse.users
# - Snowflake: SELECT * FROM iceberg_table
# - Athena:    (point at S3, query immediately)
```

**Your data leaves the proprietary kitchen and enters the open world.**

### Why Iceberg specifically

| Property | Why it matters |
|---|---|
| **Open standard** | Apache-licensed, governed by the ASF, not a single vendor |
| **Engine-agnostic** | DuckDB, Spark, Trino, Flink, Snowflake, BigQuery, Athena all read it |
| **Schema evolution** | Add/rename/drop columns without rewriting data |
| **Time travel** | Query data as of a previous snapshot — built into the format |
| **Partition evolution** | Change partitioning without rewriting existing data |
| **ACID guarantees** | Concurrent reads/writes with snapshot isolation |
| **Hidden partitioning** | Users query without knowing partition layout |
| **Parquet underneath** | Columnar, compressed, efficient for analytics |

### Architecture: DuckDB as the write engine

We already have DuckDB as a driver. DuckDB has native Iceberg extension support + native
Parquet writer. This means the dump pipeline is:

```
Source DB (any of 7 drivers)
  → Stream rows via DriverAdapter.stream()
    → [Optional] Apply masking transform (governance layer)
      → DuckDB in-process writer
        → Parquet data files + Iceberg metadata (manifest list, manifests, table metadata)
          → Local filesystem, S3, GCS, Azure Blob (via DuckDB's httpfs/s3 extensions)
```

DuckDB handles all the hard parts: Parquet encoding, compression (zstd/snappy), Iceberg
metadata generation, row group sizing, statistics. We just feed it a typed row stream.

### Package: `@maitredb/dump`

```typescript
export interface DumpOptions {
  source: Connection;
  target: DumpTarget;

  // What to dump
  tables?: string[];           // specific tables, or all if omitted
  schema?: string;
  query?: string;              // arbitrary query → dump results
  where?: string;              // filter clause applied to each table

  // How to dump
  format: 'iceberg' | 'parquet' | 'csv' | 'jsonl' | 'sql';
  compression?: 'zstd' | 'snappy' | 'gzip' | 'none';  // default: zstd
  partitionBy?: string[];      // columns to partition by (Iceberg/Parquet)
  rowGroupSize?: number;       // Parquet row group size (default: 100,000)
  maxFileSize?: string;        // e.g., "256MB" — split into multiple files

  // Data transformation in transit
  masking?: boolean;           // apply masking policy during dump
  maskingPolicy?: string;      // specific policy name, or use connection default

  // Schema handling
  includeSchema?: boolean;     // dump DDL alongside data (default: true)
  typeMapping?: 'preserve' | 'normalize';  // keep native types or map to Iceberg types

  // Concurrency
  parallelTables?: number;     // dump N tables simultaneously (default: 4)
}

export interface DumpTarget {
  path: string;                // local path, s3://, gs://, az://
  credentials?: StorageCredentials;  // for cloud storage
}

export type StorageCredentials =
  | { type: 'aws'; profile?: string; accessKeyId?: string; secretAccessKey?: string }
  | { type: 'gcs'; serviceAccountKey?: string }
  | { type: 'azure'; connectionString?: string };
```

### Output format: Iceberg

```
./warehouse/
├── users/
│   ├── metadata/
│   │   ├── v1.metadata.json          # Iceberg table metadata
│   │   └── snap-<id>-<uuid>.avro     # manifest list
│   └── data/
│       ├── 00000-0-<uuid>.parquet    # data file 1
│       ├── 00001-0-<uuid>.parquet    # data file 2
│       └── ...
├── orders/
│   ├── metadata/
│   └── data/
└── catalog.json                       # simple catalog pointing to all tables
```

Each table is a self-contained Iceberg table. A lightweight JSON catalog is generated
so engines can discover all tables in the dump.

### Output format: Parquet (simpler)

For users who don't need full Iceberg (no time travel, no metadata), plain Parquet is available:

```bash
mdb dump prod users --to parquet --output ./export/users.parquet
```

Single file or partitioned directory layout, compatible with everything.

### Output format: SQL (universal pg_dump equivalent)

```bash
mdb dump prod --schema public --to sql --output ./backup.sql
# Generates:
# CREATE TABLE users (...);
# INSERT INTO users VALUES (...), (...), ...;
# CREATE TABLE orders (...);
# ...
```

Dialect-aware SQL generation. Can target a specific output dialect:

```bash
# Dump from MySQL, generate Postgres-compatible SQL
mdb dump mysql-prod --schema app --to sql --dialect postgresql --output ./migration.sql
```

This is effectively a **cross-database migration assistant**.

### Schema translation

When dumping to Iceberg/Parquet, database-native types must map to Iceberg types:

| Source type (examples) | Iceberg type | Notes |
|---|---|---|
| `int`, `integer`, `int4` | `int` | |
| `bigint`, `int8` | `long` | |
| `smallint`, `int2` | `int` | Promoted — Iceberg has no smallint |
| `float`, `real`, `float4` | `float` | |
| `double precision`, `float8` | `double` | |
| `numeric(p,s)`, `decimal(p,s)` | `decimal(p,s)` | Precision preserved |
| `varchar(n)`, `text`, `char(n)` | `string` | |
| `boolean`, `bool` | `boolean` | |
| `date` | `date` | |
| `time` | `time` | |
| `timestamp`, `datetime` | `timestamp` | Normalized to UTC |
| `timestamptz` | `timestamptz` | |
| `json`, `jsonb` | `string` | Stored as JSON string — engines can parse |
| `bytea`, `blob`, `binary` | `binary` | |
| `uuid` | `uuid` (Iceberg v2) | Falls back to `fixed(16)` on older format versions |
| `array<T>` | `list<T>` | Nested type mapping |
| `geometry`, `geography` | `string` (WKT) | With metadata tag for GIS-aware readers |
| MongoDB subdocument | `struct<...>` | Inferred from document sampling |

### Incremental / differential dumps

For large tables, full dumps are expensive. Incremental mode captures only changes:

```bash
# First dump — full snapshot
mdb dump prod orders --to iceberg --output s3://warehouse/orders

# Subsequent dumps — only new/changed rows since last snapshot
mdb dump prod orders --to iceberg --output s3://warehouse/orders --incremental \
  --cursor-column updated_at --cursor-value "2026-04-01T00:00:00Z"
```

Iceberg's snapshot model makes this natural — each incremental dump creates a new snapshot
with only the new data files appended. Previous snapshots remain queryable (time travel).

For databases with CDC/replication support:
- **PostgreSQL**: Could use logical replication slots for true CDC
- **MySQL/MariaDB**: Could tail the binlog
- **MongoDB**: Could use change streams

These are Phase 5+ features but the `DumpOptions` interface should have an `incremental` field from day 1.

### Dump + Mask: the killer combo

```bash
# Dump production data to a staging Iceberg warehouse, with PII masked in transit
mdb dump prod --schema public --to iceberg --output s3://staging-warehouse/ \
  --mask --mask-policy agent-default
```

Data flows: `Prod DB → stream → masking transform → DuckDB Iceberg writer → S3`

The staging warehouse has the same schema and realistic data volumes, but all PII is
masked. No manual anonymization scripts. No separate ETL pipeline. One command.

This is what "front of house" means — Maître d'B stands between the kitchen and the
customer, ensuring the food (data) is presented appropriately for who's receiving it.

### Dump + Faker: backfill masked columns

When masking replaces real data with `[REDACTED]` or `NULL`, the result isn't useful for
testing. Combine with faker to replace masked values with realistic synthetic data:

```bash
mdb dump prod --schema public --to iceberg --output ./test-warehouse/ \
  --mask --mask-policy agent-default \
  --faker-fill  # replace redacted/nullified columns with faker-generated values
```

Now the test warehouse has: real schema, real data volumes, real distributions for
non-sensitive columns, and realistic fake data for sensitive columns.

### Restore / Load (reverse direction)

Dump is only half the story. Loading Iceberg/Parquet back into a database:

```bash
# Load Iceberg table into a Postgres database
mdb load dev --from iceberg --input ./warehouse/users

# Load Parquet file into MySQL
mdb load dev --from parquet --input ./export/orders.parquet --table orders

# Load with schema creation (CREATE TABLE if not exists)
mdb load dev --from iceberg --input ./warehouse/users --create-table

# Load from S3
mdb load dev --from iceberg --input s3://warehouse/orders
```

The load pipeline is the reverse: DuckDB reads Iceberg/Parquet → streams rows → driver
inserts via batched INSERTs or database-native bulk load (COPY for Postgres, LOAD DATA
for MySQL, PUT+COPY INTO for Snowflake).

### Cross-database copy with format conversion

The ultimate composition — copy data between any two databases with optional format
conversion, masking, and schema translation:

```bash
# Copy from SQL Server to Postgres, with masking
mdb copy sqlserver-prod.dbo.users → postgres-staging.public.users --mask

# Copy from MongoDB to Snowflake (document → relational flattening)
mdb copy mongo-prod.users → snowflake-analytics.raw.users --flatten

# Copy from Postgres to DuckDB local file (for offline analysis)
mdb copy prod.public.orders → local.analytics.orders
```

### CLI commands

```bash
# Dump
mdb dump <conn> <table> --to iceberg|parquet|csv|jsonl|sql --output <path>
mdb dump <conn> --schema <schema> --to iceberg --output <path>
mdb dump <conn> --query "SELECT ..." --to parquet --output <path>
mdb dump <conn> <table> --to sql --dialect postgresql|mysql|snowflake

# Dump with options
mdb dump <conn> <table> --to iceberg --output s3://bucket/path \
  --compression zstd --partition-by created_date \
  --mask --mask-policy <policy> --faker-fill

# Incremental dump
mdb dump <conn> <table> --to iceberg --output <path> \
  --incremental --cursor-column updated_at --cursor-value "2026-04-01"

# Load
mdb load <conn> --from iceberg|parquet|csv|jsonl|sql --input <path>
mdb load <conn> --from iceberg --input <path> --create-table --table <name>

# Copy
mdb copy <source-conn>.<table> → <target-conn>.<table> [--mask] [--flatten]

# Inspect an Iceberg/Parquet file without loading
mdb inspect <path> --format iceberg|parquet
# Shows: schema, row count, partitions, snapshots (Iceberg), file sizes, compression ratio

# Dump status (for long-running dumps)
mdb dump status
```

### Programmatic API

```typescript
import { Maitre } from '@maitredb/core'
import { dump, load } from '@maitredb/dump'

const mdb = new Maitre()
const conn = await mdb.connect('prod')

// Dump to Iceberg
await dump({
  source: conn,
  tables: ['users', 'orders'],
  target: { path: './warehouse/' },
  format: 'iceberg',
  masking: true,
  compression: 'zstd',
  partitionBy: ['created_date'],
  onProgress(table, rowsDumped, totalEstimate) {
    console.log(`${table}: ${rowsDumped}/${totalEstimate}`)
  }
})

// Load from Iceberg
const devConn = await mdb.connect('dev')
await load({
  target: devConn,
  input: { path: './warehouse/users' },
  format: 'iceberg',
  createTable: true,
})
```

---

## Testing Strategy

### Unit tests

- `vitest` for all packages
- Mock driver implementations for testing core logic without databases

### Integration tests

- **testcontainers** for Dockerized database instances in CI
- Each driver package has integration tests that run against a real database
- Matrix: PostgreSQL 14-17, MySQL 8.0-8.4, MariaDB 10.11-11.x, ClickHouse latest, DuckDB latest, SQLite latest
- Snowflake, MongoDB, BigQuery, Redshift, and Athena tested against cloud instances (requires CI secrets)

### E2E tests

- CLI e2e: spawn `mdb` as a child process, assert stdout/stderr/exit codes
- GUI e2e: Playwright or Tauri's built-in WebDriver support

### CI matrix

- OS: macOS (arm64), Ubuntu (x64), Windows (x64)
- Node.js: 20 LTS, 22 LTS
- All database integration tests run on Ubuntu; smoke tests on macOS/Windows

---

## Phased Delivery

| Phase | Weeks | Deliverable |
|---|---|---|
| **1: Foundation** | 1-4 | Monorepo, core types, error taxonomy, config hierarchy, Arrow result model, Postgres + MySQL + SQLite drivers (JS fallback path), CLI with query/schema/connect commands, streaming in Arrow batches, output formatters → `0.1.0-alpha` |
| **2: Full Suite + Wire** | 5-10 | All 11 drivers (add DuckDB, ClickHouse, Snowflake, MongoDB, BigQuery, Redshift, Athena), `@maitredb/wire` Rust addon (PG binary + MySQL binary parsers → Arrow), prepared statement caching, Arrow-native paths for DuckDB/ClickHouse/Snowflake/BigQuery, async execution model for cloud warehouses, caching layer, EXPLAIN/tracing, permissions, governance package, connection pooling + health, worker thread pool for transforms → `0.2.0-alpha` |
| **3: Masking & Faker** | 9-12 | Client-side data masking engine, masking policy config, auto-detection scanner, `@maitredb/faker` package, schema-aware auto-generation, FK dependency resolution, locale support → `0.3.0-alpha` |
| **4: Dump & Iceberg** | 13-16 | `@maitredb/dump` package, DuckDB-powered Parquet/Iceberg writer, schema translation, dump+mask combo, SQL dialect output, load/restore, `mdb inspect`, progress reporting → `0.4.0-alpha` |
| **5: Agent & Polish** | 17-20 | npx support, credential isolation, re-auth avoidance (token caching, key-pair preference), agent cold-start optimization, audit logging, agent governance policies (masking integrated), schema diffing, hook system, transaction support, MCP server → `0.5.0-beta` |
| **6: Optimize & Bench** | 21-22 | `mdb optimize` — native optimization recommendations per database (index, query, storage, config analysis), `mdb bench` — benchmarking with pre-filled query templates, percentile output, comparison mode → `0.6.0-beta` |
| **7: GUI** | 23-28 | Tauri app, sidecar architecture, all GUI screens, Monaco autocomplete, masking indicator + policy editor, faker UI, dump/load UI, optimization report panel, benchmark results viewer, plugin API → `0.7.0-beta` |
| **8: GA** | 29-32 | SSH tunnels, team workspace support, incremental dumps, cross-database copy, cloud storage targets (S3/GCS/Azure), query history UI, a11y, CI/CD release pipeline, docs site → `1.0.0` |

---

## Key Dependencies

| Purpose | Package |
|---|---|
| Monorepo | pnpm, turbo |
| CLI parsing | yargs |
| Table output | cli-table3 |
| CSV | csv-stringify |
| Cache (memory) | lru-cache |
| Cache (disk) | better-sqlite3 (optional dep) |
| Secrets | keytar (optional dep) |
| SSH tunnels | ssh2 |
| GUI framework | @tauri-apps/api v2 |
| GUI frontend | react, vite, tailwindcss |
| SQL editor | @monaco-editor/react |
| Data grid | @tanstack/react-table |
| Plan visualization | @xyflow/react |
| BigQuery driver | @google-cloud/bigquery |
| Redshift driver | @aws-sdk/client-redshift-data |
| Athena driver | @aws-sdk/client-athena |
| Arrow (JS) | apache-arrow |
| Rust native addon | napi-rs (build framework), napi (runtime) |
| Worker pool | piscina |
| Fast hashing | xxhash-wasm (statement cache keys) |
| Fake data generation | @faker-js/faker |
| Parquet/Iceberg write | @duckdb/node-api (in-process DuckDB with iceberg extension) |
| Cloud storage | DuckDB httpfs/s3 extensions (built-in) |
| Testing | vitest, testcontainers |
| CLI e2e | execa |

---

## Appendix: Future Considerations

Items identified during architectural planning that deserve deeper discussion before or during
implementation. These are **not yet decided** — they're captured here so they don't get lost.

### A.1 — Masking vs. Database-Native Policies: Overlap & Conflict Resolution

When a database already has native masking (Snowflake Dynamic Data Masking, PostgreSQL column-level
security, MongoDB field-level encryption), how should Maître d'B's client-side masking interact?

Options to explore:
- **Additive only**: Maître d'B masking stacks on top of whatever the database already masks. If the DB returns `***`, we don't double-mask it.
- **Override mode**: Maître d'B masking replaces DB-level masking for consistency across heterogeneous databases (so the same policy works the same way regardless of which DB is behind it).
- **Detect & defer**: If the driver detects native masking is active on a column, skip client-side masking and log it.
- **Conflict warning**: If both DB-native and client-side masking apply to the same column, emit a warning in the audit log.

### A.2 — Faker: Relational Consistency Across Large Graphs

For deeply nested FK chains (e.g., `tenants → organizations → departments → users → orders → order_items → shipping`), how do we:
- Handle circular references (e.g., `users.manager_id → users.id`)?
- Scale to millions of rows without holding the entire dependency graph in memory?
- Allow partial seeding (seed `orders` with 10K rows for an existing set of users)?

Potential approach: two-pass generation — first pass builds an ID pool per table (lightweight), second pass generates full rows referencing those pools.

### A.3 — Faker: Privacy-Safe Correlation

For realistic test data, some columns should correlate: `city` should match `state` which should match `zip_code`. The faker library handles this within a single address, but cross-column correlation across custom schemas needs thought. Consider "column groups" in the faker config that generate together.

### A.4 — Masking Performance on Large Result Sets

If an agent streams 1M rows and every row needs 5 columns masked, what's the performance overhead? Need to benchmark:
- Regex-based pattern matching per cell
- SHA-256 hashing per cell (for `hash` strategy)
- Whether masking should run in a worker thread to avoid blocking the event loop

### A.5 — MCP Server: Tool Surface Design

When Maître d'B runs as an MCP server (`mdb mcp-server`), which capabilities are exposed as tools?
- `query` — obvious, but with what guardrails baked into the tool definition?
- `schema` — safe, read-only, should always be available
- `faker seed` — should agents be able to generate data? Probably yes for sandboxes, never for prod.
- `masking` — should agents be able to see or modify masking policies? Probably not.
- Tool descriptions need to be rich enough that an LLM knows when and how to use them.

### A.6 — Connection Proxy / Sidecar Mode

Should Maître d'B support running as a persistent local proxy? Instead of CLI invocations:
```
mdb proxy start --port 5433 --target prod
# Now any postgres client can connect to localhost:5433
# Maître d'B applies masking, governance, audit logging transparently
```
This would let existing tools (psql, DBeaver, BI dashboards) benefit from masking and governance without modification. Significant scope expansion but architecturally powerful.

### A.7 — Data Lineage Tracking

When an agent queries data, transforms it, and writes it back, can Maître d'B track the lineage?
- Which source columns contributed to which output columns?
- Was masking applied, and which strategy?
- Log this in the audit trail for compliance: "Agent X read masked email data from `users`, no raw PII was exposed."

### A.8 — Export / Import Beyond Query Results

Bulk data operations that go beyond `SELECT → format`:
- `mdb export prod users --where "created_at > '2025-01-01'" --format parquet`
- `mdb import dev users --file seed.csv --on-conflict update`
- Cross-database copy: `mdb copy prod.users → staging.users --count 1000 --mask`

The `--mask` flag on `copy` is particularly interesting — copy data between environments with masking applied in transit.

### A.9 — Notebook / Worksheet Mode

Saved, shareable query collections with inline results — like a lightweight Jupyter for SQL:
```
.maitredb/notebooks/
├── daily-health-check.mdb.json
├── user-audit-queries.mdb.json
```
Each notebook is a sequence of queries with saved results, annotations, and chart configs. Viewable in GUI, executable via CLI (`mdb notebook run daily-health-check`).

### A.10 — Cost Estimation for Cloud Warehouses

Snowflake and ClickHouse Cloud charge per query. Before an agent runs an expensive query:
- Estimate cost in credits/dollars based on EXPLAIN output
- Enforce a `maxQueryCost` governance policy
- Show cost in the trace output: "This query would scan 2.3TB → ~$4.60 in Snowflake credits"

### A.11 — Schema Versioning & Migration Awareness

Maître d'B is not a migration tool, but it could:
- Detect pending migrations (check `schema_migrations` / `flyway_schema_history` tables)
- Warn when the schema has drifted from the last known state
- Snapshot schema state for diff comparison over time (not just cross-connection)

### A.12 — Iceberg Catalog Integration

The current design writes a simple `catalog.json` file alongside the data. For production use,
teams often run a proper Iceberg catalog (AWS Glue, Hive Metastore, Nessie, Polaris/REST catalog).
Should Maître d'B support registering dumped tables in an external catalog?

```bash
mdb dump prod users --to iceberg --output s3://warehouse/users \
  --catalog rest --catalog-uri https://polaris.internal/api/v1
```

This would make dumped tables immediately discoverable by Spark/Trino/etc. without manual
catalog registration. DuckDB's Iceberg extension supports REST catalogs, so the plumbing exists.

### A.13 — Delta Lake and Hudi Support

Iceberg is the primary target, but Delta Lake (dominant in Databricks shops) and Apache Hudi
(common in AWS/real-time) are also open table formats. Should `--to delta` and `--to hudi`
be supported?

DuckDB has Delta Lake read/write support via `delta` extension. Hudi is less mature in DuckDB.
Could support Delta as a secondary format and leave Hudi for community plugin.

### A.14 — Document-to-Relational Flattening (MongoDB → Iceberg)

MongoDB documents are nested/schemaless. When dumping to Iceberg (which is relational), how
to handle:
- Nested objects → separate tables with foreign keys? Or `struct<>` columns?
- Arrays → `list<>` type? Or explode into rows?
- Schema variance across documents → union schema? Or per-collection sampling?

Need a `--flatten` mode with configurable depth and a `--sample-size` for schema inference.

### A.15 — Dump Scheduling & Orchestration

For recurring dumps (e.g., nightly prod → staging with masking):
```bash
mdb dump schedule "prod-to-staging" \
  --source prod --schema public --to iceberg --output s3://staging/ \
  --mask --cron "0 2 * * *"
```

Could be a lightweight wrapper around system cron / systemd timers, or a built-in scheduler.
More ambitious: integration with Airflow/Dagster/Prefect as a dump operator.

### A.16 — Dump Resume / Checkpoint

Large dumps (multi-TB) can take hours. If a dump fails mid-way:
- Should there be a checkpoint system that allows resuming from the last completed table/partition?
- Iceberg's snapshot model helps — completed table snapshots are valid even if the overall dump didn't finish.
- A `.mdb-dump-state.json` file could track progress per table.

### A.17 — Internationalization of CLI Output

Should error messages, table headers, and help text be localizable? Probably not in v1 (English-only is fine for a dev tool), but the architecture shouldn't make it impossible. Keep user-facing strings in one place, not scattered across driver code.
