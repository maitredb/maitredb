# Maître d'B — Brewing Ideas

> Non-essential but genuinely useful developer-friendly features to consider adding in future milestones.
> None of these are required for correctness or core functionality, but each one meaningfully improves
> the experience of using maitredb day-to-day — for both humans and AI agents.

---

## 1. Local Schema Cache for Agents

Store introspection results (tables, columns, indexes, foreign keys) in the `packages/cache` SQLite
disk cache keyed by connection name + schema fingerprint. When an agent calls `getColumns()` or
`getTables()`, return from cache if the TTL hasn't expired instead of hitting `information_schema`.

- Configurable TTL per connection (default: 10 minutes, override via `MDB_SCHEMA_CACHE_TTL`)
- Cache invalidated automatically on DDL statements (`CREATE TABLE`, `ALTER TABLE`, `DROP …`)
- Manual bust via `mdb cache clear --schema <conn>` or `--no-cache` flag on any command
- Reduces cold-start latency for agentic workflows from O(schema size) to near-zero

---

## 2. Query Progress Bars & Runtime Estimates

For long-running queries, render a live progress bar in the CLI terminal using a TUI library
(e.g. `cli-progress` or a custom ANSI renderer).

- Show elapsed time, rows received so far, and estimated rows remaining when the driver reports
  total row count upfront (e.g. DuckDB, ClickHouse)
- Fall back to an indeterminate spinner when row count is unknown
- Show throughput (rows/s, MB/s) in the right gutter
- Suppress automatically when stdout is not a TTY (piped output, CI, agent mode)

---

## 3. Query History & Replay Log

Persist every executed query to a structured log (`~/.maitredb/history.jsonl`), one JSON line per
entry with timestamp, connection name, SQL, duration, row count, and exit status.

- `mdb history` — tail / page through history with fuzzy search
- `mdb history replay <id>` — re-execute a previous query against the same (or a different) connection
- `mdb history export --format csv|json|sql` — dump history for auditing
- Opt-out via `MDB_NO_HISTORY=1` or `history: false` in config
- History entries for agent sessions tagged with `agent: true` for easy filtering

---

## 4. Shell Autocomplete

Generate shell completion scripts for `bash`, `zsh`, and `fish` based on the yargs command tree.

- `mdb completion bash | sudo tee /etc/bash_completion.d/mdb`
- Completions cover: sub-commands, flags, connection names (read from config), database names,
  table names (from schema cache if available), and saved query names
- Connection and table completions are populated lazily — only fetched when the user tabs after
  `mdb query <TAB>`

---

## 5. Rich TUI (Interactive Mode)

A full-screen terminal UI launched via `mdb tui` or `mdb --interactive`.

- Split-pane layout: connection tree on the left, SQL editor + results on the right
- SQL editor with syntax highlighting, bracket matching, and multi-statement support
- Results pane with scrollable table, column resizing, and inline row detail view
- Query history sidebar and schema explorer panel
- Keyboard-driven (vim-style bindings optional via config)
- Built with a TUI library such as `ink` (React for terminals) to stay in the TypeScript ecosystem

---

## 6. Optional Table Profiling

Run lightweight statistical analysis on a table or result set and render a summary report.

- `mdb profile <conn> <table>` or `--profile` flag on any `query` command
- Per-column stats: null %, cardinality, min/max/mean/p50/p95, top-10 frequent values, sample values
- Detects likely PII columns (email patterns, SSN patterns) and flags them
- Output as terminal table, JSON, or HTML report
- Useful for data validation after migrations or during schema exploration

---

## 7. Saved Queries & Query Library

Store named, parameterized queries in `.maitredb/queries/` as `.sql` files with a YAML front-matter
header for metadata.

```sql
-- name: active-users-by-region
-- description: Count active users grouped by region for the last N days
-- params: days:int=30
SELECT region, COUNT(*) AS cnt
FROM users
WHERE last_active > NOW() - INTERVAL :days DAY
GROUP BY region
ORDER BY cnt DESC;
```

- `mdb run active-users-by-region --days 7` resolves params and executes
- `mdb queries list` shows all saved queries with descriptions
- AI agents can discover and invoke saved queries by name without needing raw SQL
- Version-control friendly — queries live as plain files in the project repo

---

## 8. Connection Health Dashboard

`mdb status` renders a live dashboard of all configured connections:

- Latency (ping round-trip), pool utilisation, active queries, replication lag (where supported)
- Color-coded health indicators: green / yellow / red
- Auto-refreshes every N seconds (configurable, default 5s)
- Useful for ops runbooks and monitoring during migrations or load tests

---

## 9. Multi-Connection Query Fan-Out

Execute the same query across multiple connections in parallel and display a unified diff-style
comparison of the results.

- `mdb query --on staging,prod "SELECT COUNT(*) FROM orders"`
- Results shown side-by-side with cells highlighted where values diverge
- Useful for validating data parity between environments after a migration
- Row counts, schema shape, and sample rows can all be compared

---

## 10. Schema Diff & Migration Hints

Compare the schema of two connections (or two points in time via the schema cache) and produce a
human-readable diff.

- `mdb diff staging prod` — shows added/removed/changed tables, columns, indexes, constraints
- Optionally generate a migration SQL scaffold (`--emit-migration`) as a starting point
- Warnings for breaking changes (dropped columns, type narrowing, removed indexes)
- Works across different database dialects where possible (e.g. Postgres → Snowflake migration)

---

## 11. Data Masking Preview

Allow developers to preview what masked output looks like for a given governance policy before
enabling it in production.

- `mdb query <conn> <sql> --preview-mask <policy-file>` renders the query result with masking
  applied, without saving or forwarding the data
- Shows which columns were masked and which rule triggered each mask
- Supports side-by-side view: raw value | masked value (for admins with `--show-diff` flag)
- Helps policy authors validate their masking rules quickly in development

---

## 12. Query Cost Estimator

Before executing a query, optionally run `EXPLAIN` / `EXPLAIN ANALYZE` (or dialect equivalent) and
surface an estimated cost/rows/time in the CLI before asking for confirmation.

- `mdb query <conn> <sql> --dry-run` prints the query plan and estimated cost, then exits
- `mdb query <conn> <sql> --warn-above 1GB` aborts with exit code 1 if estimated scan exceeds
  the threshold (useful in CI / agent guardrails)
- Integrates with the governance package as an additional pre-flight check

---

## 13. Export & Watch Mode

Continuously stream query results to a file as new rows arrive, useful for long-running analytics
or change-data-capture scenarios.

- `mdb query <conn> <sql> --watch 30s --out results.parquet` re-executes every 30 seconds and
  appends new rows (deduplicating on a user-supplied key column)
- Output formats: Parquet, CSV, JSONL, or SQL INSERT statements
- Integrates with `packages/dump` for format handling
- `--watch` mode respects `--limit` and governance policies on every poll cycle

---

> These ideas are intentionally unordered and unscheduled. They should be revisited during milestone
> planning and promoted to `implementation-plan.md` when there is capacity and clear demand.
