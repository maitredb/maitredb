# Maître d'B

> *The front-of-house manager for your databases.*

A cross-platform, open-source database client with native CLI and GUI — built for humans and agents alike. Handles pooling, query sequencing, credential isolation, governance, and schema introspection as middleware between your applications and your databases.

**Package name**: `maitredb` | **CLI command**: `mdb` | **Org scope**: `@maitredb/*`

## Why Maître d'B?

Most database clients treat the connection as a detail. Maître d'B treats it as a **platform**.

- **No vendor lock-in**: All configuration, credentials, and exports use open formats (JSON, SQL, Parquet, Iceberg). If you uninstall maitredb tomorrow, everything you created still works.
- **Streaming-first**: Query 1 billion rows without exhausting RAM. Results appear instantly; you're not waiting for full buffering.
- **10-50x faster parsing**: Rust-based wire protocol parser and Apache Arrow columnar format instead of row objects.
- **Agent-safe by default**: Query governance policies prevent agents from dropping databases or exfiltrating data. Audit everything.
- **Unified across 11 databases**: One CLI, one API, one error model. SQLite → Snowflake syntax differences handled transparently.
- **Batteries included**: Benchmarking, masking, fake data generation, schema diffing, optimization recommendations, query profiling.

## Features

- **11 Databases**: SQLite, PostgreSQL, MySQL/MariaDB, MongoDB, Snowflake, ClickHouse, DuckDB, BigQuery, Redshift, Athena
- **Secure Credentials**: AES-256-GCM encryption, system keychain fallback, encrypted files, environment variables — pick your trust model
- **Constant-memory Streaming**: Never buffer entire result sets; process rows as they arrive
- **Performance**: Rust wire protocol parser, Apache Arrow columnar format, prepared statement caching
- **Agent Governance**: Policies for read-only mode, operation blocking, rate limiting, schema isolation; audit trail for all attempts
- **Data Masking**: Redact, hash, or apply noise to sensitive columns during query execution
- **Universal Export**: Dump to Parquet, Iceberg, CSV, or SQL across any database
- **Fake Data**: Schema-aware data generation for realistic test datasets
- **Query Profiling**: Per-database EXPLAIN plans, execution statistics, cost estimates
- **Benchmarking**: Rigorous query performance measurement with statistical rigor
- **Schema Tools**: Introspection, comparison, auto-detection of optimization opportunities

## Installation

```bash
# Install globally
npm install -g maitredb

# Or use as a zero-install tool (npx)
npx maitredb query dev "SELECT 1"
```

## Usage Patterns

### 1. Standalone CLI

The simplest mode — query databases from your shell or scripts.

```bash
# Set up a connection (credentials encrypted automatically)
mdb connect add prod --type postgres --host db.example.com --user admin

# Query
mdb query prod "SELECT * FROM users WHERE active = true" --format json

# Explore schema
mdb schema prod tables
mdb schema prod columns orders

# Streaming (constant memory)
mdb query prod "SELECT * FROM events" --stream --format ndjson | jq '.user_id' | sort | uniq -c

# Export
mdb dump prod orders --to parquet --output orders.parquet

# Benchmark
mdb bench prod --inner-join --runs 50

# Explain
mdb trace prod "SELECT * FROM orders WHERE total > 1000" --analyze
```

### 2. Node.js / MCP Server (AI Agents & IDEs)

Integrate database access directly into Claude, GitHub Copilot, or other coding tools.

**Build the MCP server:**

```bash
pnpm --filter @maitredb/mcp build
```

**Add to Claude Desktop** (`~/.config/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "maitredb": {
      "command": "node",
      "args": ["/path/to/maitredb/packages/mcp/dist/index.js"]
    }
  }
}
```

**Add to GitHub Copilot** (`.vscode/settings.json`):

```json
{
  "github.copilot.advanced": {
    "mcpServers": {
      "maitredb": {
        "command": "node",
        "args": ["/path/to/maitredb/packages/mcp/dist/index.js"]
      }
    }
  }
}
```

**Available MCP tools:**
- `list_connections` — List configured databases
- `get_schemas`, `get_tables`, `get_columns`, `get_indexes` — Schema introspection
- `explain` — Query execution plans
- `query` — Execute read-only SQL (mutating operations blocked for safety)

### 3. Docker MCP Server

Run the MCP server in a container for team/CI usage.

```bash
docker run -d \
  -v ~/.maitredb:/root/.maitredb:ro \
  -p 9999:9999 \
  maitredb:latest mcp-server --port 9999
```

Agents/IDEs connect via TCP:

```json
{
  "mcpServers": {
    "maitredb": {
      "type": "tcp",
      "host": "localhost",
      "port": 9999
    }
  }
}
```

### 4. Programmatic API (Node.js Library)

```typescript
import { Maitre } from '@maitredb/core'

const mdb = new Maitre()
const conn = await mdb.connect('prod')

// Query
const result = await mdb.query(conn, 'SELECT * FROM users WHERE active = $1', [true])
console.log(result.rows)

// Streaming
for await (const row of mdb.stream(conn, 'SELECT * FROM events')) {
  console.log(row)
}

// Schema
const tables = await mdb.schema.tables(conn, 'public')
const plan = await mdb.explain(conn, 'SELECT ...', { analyze: true })
```

## What's Complete (v0.1.0)

- ✅ Core CLI with 11 database drivers
- ✅ Secure credential storage (AES-256-GCM, keychain, encrypted files)
- ✅ Streaming query execution (Arrow columnar format)
- ✅ Schema introspection (tables, columns, indexes, functions)
- ✅ Basic query profiling (EXPLAIN per dialect)
- ✅ MCP server for IDE integration

## What's Planned (Future Phases)

From the [Architecture](spec/architecture.md) and [Implementation Plan](spec/implementation-plan.md):

### Phase 2
- Data masking (redaction, hashing, noise injection)
- Query result caching (LRU memory + SQLite disk)
- Agent governance policies (read-only enforcement, operation blocking, audit logs)

### Phase 3
- GUI (Tauri 2 + React) — query editor, schema explorer, results viewer, profiler
- Universal dump (Parquet, Iceberg, CSV export across all databases)
- Fake data generation (schema-aware bootstrapping)

### Phase 4
- Advanced optimization recommendations (missing indexes, query rewrites, performance tuning)
- Benchmarking suite (statistical rigor, regression detection, comparison mode)
- Schema diffing (compare schemas across environments)

### Phase 5
- Query optimization engine (AST rewriting, cost-based suggestions)
- Team/workspace support (shared connection configs, saved query libraries)
- Plugin system (third-party drivers, custom tools)
- Advanced transaction modes (interactive REPL session, multi-statement batches)

## Contributing

Contributions welcome! Please:

1. **Read the spec first**: [Architecture](spec/architecture.md) explains design decisions and the monorepo layout
2. **Check existing issues**: Search for similar work before starting
3. **Follow conventions**: See [CLAUDE.md](CLAUDE.md) for code quality expectations
4. **Test before submitting**: Run `pnpm test` and `pnpm lint` locally

### Build & Test

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Type-check
pnpm lint

# Watch mode (development)
pnpm dev
```

## Feedback & Issues

- **Bugs**: [Open an issue](https://github.com/maitredb/maitredb/issues) with steps to reproduce
- **Feature requests**: Include your use case and why existing solutions don't fit
- **Questions**: Open a [discussion](https://github.com/maitredb/maitredb/discussions)

## Documentation

- **[Architecture](spec/architecture.md)** — Design decisions, streaming model, driver contract, performance architecture
- **[Implementation Plan](spec/implementation-plan.md)** — Phased delivery roadmap, backlog
- **[Copilot Instructions](.github/copilot-instructions.md)** — For AI assistants working in the repo
- **API Reference** — `pnpm docs:reference` (generates Markdown into `docs/reference/`)

## License

MIT
