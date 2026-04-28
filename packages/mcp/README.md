# @maitredb/mcp

MCP stdio server for Maître d'B.

This package is currently intended for source checkouts of the monorepo (pre-public preview).

## Build

```bash
pnpm --filter @maitredb/mcp build
```

## Run

```bash
pnpm --filter @maitredb/mcp build
node packages/mcp/dist/index.js
```

## Tool surface

- `maitredb_list_connections`
- `maitredb_get_schemas`
- `maitredb_get_tables`
- `maitredb_get_columns`
- `maitredb_get_indexes`
- `maitredb_explain` (EXPLAIN only; ANALYZE is disabled in MCP mode)
- `maitredb_query` (read-only; write and multi-statement SQL blocked)

## VS Code MCP config example

```json
{
  "servers": {
    "maitredb": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/maitredb/packages/mcp/dist/index.js"]
    }
  }
}
```
