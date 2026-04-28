# Maître d'B

> *The front-of-house manager for your databases.*

A cross-platform, open-source database client with native CLI and GUI — built for humans and agents alike. Handles pooling, query sequencing, credential isolation, guardrails, and schema introspection as middleware between your "customers" (humans, AI agents, scripts) and the "kitchen" (your databases).

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

## v0.1.0 Highlights (2026-04-07)

### ✅ Secure Credential Store

**Never store passwords in plaintext again!**

```bash
# Add a connection with secure credential storage
mdb connect add prod --type postgres --host db.example.com --password secret123

# Credentials are encrypted and stored separately from connection metadata
mdb connect list
# prod — postgresql @ db.example.com:5432 [creds: encrypted-file]
```

**Features:**
- 🔐 **AES-256-GCM encryption** with PBKDF2 key derivation (310K iterations)
- 📱 **Cross-platform**: Windows, macOS, Linux, containers
- 🔑 **Multiple backends**: System keychain, encrypted file, environment variables
- 🔄 **Graceful fallback**: Automatically uses best available method
- 🧪 **31 comprehensive tests** covering all scenarios

### 🌐 Platform Support

| Platform | Keychain | Encrypted File | Environment Vars |
|----------|----------|----------------|------------------|
| Windows 10/11 | ✅ Credential Vault | ✅ Full support | ✅ Full support |
| macOS | ✅ Keychain Access | ✅ Full support | ✅ Full support |
| Ubuntu/Debian | ⚠️ Requires libsecret | ✅ Full support | ✅ Full support |
| Fedora/RHEL | ⚠️ Requires libsecret | ✅ Full support | ✅ Full support |
| Docker/Containers | ❌ Not available | ✅ Full support | ✅ Full support |
| CI/CD | ❌ Not available | ✅ Full support | ✅ Full support |

*Keychain backend is optional - encrypted file backend works everywhere!*

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

- [Implementation Plan](spec/implementation-plan.md)
- [Architecture](spec/architecture.md)
- API Reference — `pnpm docs:reference` (generates Markdown into `docs/reference/`)

## License

MIT
