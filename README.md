# Maître d'B

<p align="center">
  <img src="img/Maitre’dB.png" alt="Maître d'B logo" width="320" />
</p>

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

### Available now (v0.0.1)

- **11 Database drivers registered in CLI/bootstrap**: SQLite, PostgreSQL, MySQL/MariaDB, MongoDB, Snowflake, ClickHouse, DuckDB, BigQuery, Redshift, Athena
- **Secure credential storage**: credentials are stored outside connection config files
- **Constant-memory streaming**: `mdb query --stream` reads in Arrow batches
- **Schema and permissions introspection**: tables/columns/indexes/functions/procedures/types plus roles/grants where supported
- **Local query history**: query metadata is stored in local history DB for auditing
- **MCP stdio server**: read-only query and schema tooling for coding agents

### Planned (not fully shipped yet)

- Rust wire-protocol hot path and full Arrow-native parsing across drivers
- Governance policy engine with approvals, rate limits, and per-connection policy mapping
- Data masking transforms, universal dump/export, benchmarking suite, and GUI

## Installation

maitredb is currently source-first and pre-public preview (not published to npm yet).

```bash
# Clone and install workspace dependencies
pnpm install

# Build CLI and MCP packages
pnpm --filter @maitredb/cli build
pnpm --filter @maitredb/mcp build

# Verify CLI
node apps/cli/dist/cli.js --help
```

## Usage Patterns

### 1. CLI from source checkout

Use the built CLI directly from this repository.

```bash
# Build once
pnpm --filter @maitredb/cli build

# Add and verify a local sqlite connection
node apps/cli/dist/cli.js connect add dev --type sqlite --path ./dev.db
node apps/cli/dist/cli.js connect list

# Query and stream
node apps/cli/dist/cli.js query dev "SELECT 1" --format json
node apps/cli/dist/cli.js query dev "SELECT * FROM sqlite_master" --stream --format ndjson

# Introspection and audit history
node apps/cli/dist/cli.js schema dev tables --schema main
node apps/cli/dist/cli.js history --last 10
```

### 2. MCP stdio from source checkout

Build the MCP package and point your MCP client to this local workspace.

```bash
pnpm --filter @maitredb/mcp build
```

Example MCP stdio config (local source checkout):

```json
{
  "mcpServers": {
    "maitredb": {
      "command": "node",
      "args": ["/absolute/path/to/maitredb/packages/mcp/dist/index.js"]
    }
  }
}
```

Available MCP tools:
- `maitredb_list_connections`
- `maitredb_get_schemas`
- `maitredb_get_tables`
- `maitredb_get_columns`
- `maitredb_get_indexes`
- `maitredb_explain` (EXPLAIN only; ANALYZE disabled)
- `maitredb_query` (read-only; mutating and multi-statement SQL blocked)

### 3. Planned integrations (not available yet)

- Docker/TCP MCP deployment examples
- Stable published npm packages for global install and npx
- Higher-level programmatic API examples in root README

## Security & Safety

- Connection credentials are not stored in `connections.json`; they are stored separately via credential backends.
- Local history stores SQL text for auditability; obvious secret literals are redacted before persistence.
- MCP tools are read-only by default: mutating and multi-statement SQL is blocked.
- Agent mode and advanced governance workflows are experimental and should be treated as pre-release behavior.

## What's Complete (v0.0.1)

- ✅ Core CLI command set: `connect`, `query`, `schema`, `permissions`, `history`
- ✅ Connection manager + lazy driver registration across supported dialects
- ✅ Secure credential storage separated from connection metadata
- ✅ Streaming query path and local query history/audit storage
- ✅ MCP stdio server with read-only query and introspection tools

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
