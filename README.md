# Maître d'B

> *The front-of-house manager for your databases.*

A cross-platform, open-source database client with native CLI and GUI — built for humans and agents alike. Handles pooling, query sequencing, credential isolation, and schema introspection as middleware between your "customers" (humans, AI agents, scripts) and the "kitchen" (your databases).

**Package name**: `maitredb` | **CLI command**: `mdb` | **Org scope**: `@maitredb/*`

## Features

- **Universal Database Access**: Connect to SQLite, PostgreSQL, MySQL, MongoDB, Snowflake, ClickHouse, DuckDB, BigQuery, Redshift, and Athena.
- **Credential Isolation**: Secure credential management with keychain, encrypted file, and environment variable support.
- **Streaming-First Architecture**: Constant-memory streaming for large result sets.
- **Performance Optimized**: Rust-based wire protocol parsing for 10-50x faster results.
- **Agent Governance**: Policy enforcement for safe agent access.
- **Data Masking**: Client-side masking to protect sensitive data.
- **Schema Introspection**: Comprehensive schema exploration and comparison.
- **Query Optimization**: Built-in recommendations for database performance tuning.
- **Benchmarking**: Rigorous query performance measurement.
- **Universal Dump**: Export data to Iceberg, Parquet, CSV, and SQL.
- **Data Bootstrapping**: Generate realistic fake data for testing.

## Installation

```bash
# Install globally
npm install -g maitredb

# Or use as a zero-install tool
npx maitredb query dev "SELECT 1"
```

## Quick Start

### Add a Connection

```bash
mdb connect add dev --type sqlite --database ./dev.db
```

### Run a Query

```bash
mdb query dev "SELECT * FROM users LIMIT 10"
```

### Explore Schema

```bash
mdb schema dev tables
mdb schema dev columns users
```

### Export Data

```bash
mdb dump dev users --to csv --output users.csv
```

## Documentation

- [Implementation Plan](pm/implementation-plan.md)
- [Architecture](pm/architecture.md)

## License

MIT
