#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { MaitredbMcpRuntime } from './runtime.js';

const DEFAULT_MAX_ROWS = 1_000;

async function main(): Promise<void> {
  const runtime = new MaitredbMcpRuntime();

  const server = new McpServer({
    name: 'maitredb-mcp',
    version: '0.1.0',
  });

  server.registerTool(
    'maitredb_list_connections',
    {
      title: 'List Connections',
      description: 'List configured Maître d\'B connection names.',
      inputSchema: {},
    },
    async () => {
      const connections = await runtime.listConnections();
      const payload = { connections };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'maitredb_get_schemas',
    {
      title: 'Get Schemas',
      description: 'Return schemas for a connection.',
      inputSchema: {
        connection: z.string(),
      },
    },
    async ({ connection }) => {
      const schemas = await runtime.getSchemas(connection);
      const payload = { connection, schemas };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'maitredb_get_tables',
    {
      title: 'Get Tables',
      description: 'Return tables/views for a connection and optional schema.',
      inputSchema: {
        connection: z.string(),
        schema: z.string().optional(),
      },
    },
    async ({ connection, schema }) => {
      const tables = await runtime.getTables(connection, schema);
      const payload = { connection, schema, tables };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'maitredb_get_columns',
    {
      title: 'Get Columns',
      description: 'Return columns for a specific table.',
      inputSchema: {
        connection: z.string(),
        schema: z.string(),
        table: z.string(),
      },
    },
    async ({ connection, schema, table }) => {
      const columns = await runtime.getColumns(connection, schema, table);
      const payload = { connection, schema, table, columns };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'maitredb_get_indexes',
    {
      title: 'Get Indexes',
      description: 'Return indexes for a specific table.',
      inputSchema: {
        connection: z.string(),
        schema: z.string(),
        table: z.string(),
      },
    },
    async ({ connection, schema, table }) => {
      const indexes = await runtime.getIndexes(connection, schema, table);
      const payload = { connection, schema, table, indexes };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'maitredb_explain',
    {
      title: 'Explain Query',
      description: 'Run read-only EXPLAIN for a SQL query. ANALYZE is disabled in MCP mode.',
      inputSchema: {
        connection: z.string(),
        sql: z.string().min(1),
      },
    },
    async ({ connection, sql }) => {
      const plan = await runtime.explain(connection, sql, false);
      const payload = { connection, analyze: false, plan };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'maitredb_query',
    {
      title: 'Execute Read-Only Query',
      description: 'Execute a read-only SQL query. Write and multi-statement SQL is blocked in MCP mode.',
      inputSchema: {
        connection: z.string(),
        sql: z.string().min(1),
        maxRows: z.number().int().positive().max(10_000).optional(),
      },
    },
    async ({ connection, sql, maxRows }) => {
      const result = await runtime.query(connection, sql, maxRows ?? DEFAULT_MAX_ROWS);
      const payload = { connection, ...result };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
        structuredContent: payload,
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const close = async (): Promise<void> => {
    await Promise.allSettled([server.close(), runtime.close()]);
  };

  process.once('SIGINT', () => {
    void close().finally(() => process.exit(0));
  });

  process.once('SIGTERM', () => {
    void close().finally(() => process.exit(0));
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
