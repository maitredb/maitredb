import { Pool, PoolClient, QueryResult as PgQueryResult, types as pgTypes } from 'pg';
import type {
  DriverAdapter,
  ConnectionConfig,
  ConnectionTestResult,
  QueryResult,
  Row,
  SchemaInfo,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  FunctionInfo,
  ProcedureInfo,
  RoleInfo,
  GrantInfo,
  ExplainResult,
  Transaction,
  DriverCapabilities,
  TransactionOptions,
  ExplainOptions,
  Connection,
} from '@maitredb/plugin-api';
import { MaitreError, MaitreErrorCode } from '@maitredb/core';
import { MaitreType } from '@maitredb/core';

// Register UUID parser to return strings instead of Buffers
pgTypes.setTypeParser(pgTypes.builtins.UUID, (val: string) => val);

/**
 * PostgreSQL driver adapter using the `pg` package.
 * Implements the full DriverAdapter interface with streaming, introspection, and tracing.
 */
/** PostgreSQL driver implemented via the native `pg` client. */
export class PostgresDriver implements DriverAdapter {
  readonly dialect: 'postgresql' = 'postgresql';

  private pool?: Pool;

  constructor() {
    // Configure pg to use bigint for numeric types to avoid precision loss
    pgTypes.setTypeParser(pgTypes.builtins.INT8, (val: string) => BigInt(val));
    pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (val: string) => val); // Keep as string for precision
  }

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  async connect(config: ConnectionConfig): Promise<Connection> {
    const poolConfig = this.buildPoolConfig(config);
    this.pool = new Pool(poolConfig);

    // Test the connection
    const client = await this.pool.connect();
    await client.query('SELECT 1');
    client.release();

    return { config, pool: this.pool };
  }

  async disconnect(conn: Connection): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
  }

  async testConnection(config: ConnectionConfig): Promise<ConnectionTestResult> {
    const start = Date.now();
    let client: PoolClient | undefined;

    try {
      const poolConfig = this.buildPoolConfig(config);
      const tempPool = new Pool(poolConfig);
      client = await tempPool.connect();

      const result = await client.query('SELECT version() as version, current_database() as database');
      const version = result.rows[0]?.version || 'unknown';
      const database = result.rows[0]?.database || config.database || 'unknown';

      await client.release();
      await tempPool.end();

      return {
        success: true,
        latencyMs: Date.now() - start,
        serverVersion: version,
        databaseName: database,
      };
    } catch (err) {
      if (client) {
        try {
          await client.release();
        } catch {}
      }
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async validateConnection(conn: Connection): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // Query Execution
  // ============================================================================

  async execute(conn: Connection, query: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const start = Date.now();
      const result = await client.query(query, params);
      const durationMs = Date.now() - start;

      return this.mapQueryResult(result, durationMs);
    } finally {
      client.release();
    }
  }

  async* stream(conn: Connection, query: string, params?: unknown[]): AsyncIterable<Row> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(query, params);
      for (const row of result.rows) {
        yield this.mapRow(row);
      }
    } finally {
      client.release();
    }
  }

  async cancelQuery(conn: Connection, queryId: string): Promise<void> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    // PostgreSQL uses pg_cancel_backend to cancel queries
    // queryId should be the backend PID
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_cancel_backend($1)', [queryId]);
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // Transactions
  // ============================================================================

  async beginTransaction(conn: Connection, options?: TransactionOptions): Promise<Transaction> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    await client.query('BEGIN' + (options?.isolationLevel ? ` ${options.isolationLevel}` : ''));

    return {
      client,
      commit: async () => {
        await client.query('COMMIT');
        client.release();
      },
      rollback: async () => {
        await client.query('ROLLBACK');
        client.release();
      },
      query: async (query: string, params?: unknown[]) => {
        const result = await client.query(query, params);
        return this.mapQueryResult(result);
      },
    };
  }

  // ============================================================================
  // Schema Introspection
  // ============================================================================

  async getSchemas(conn: Connection): Promise<SchemaInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT nspname as name,
               pg_catalog.obj_description(n.oid, 'pg_namespace') as comment
        FROM pg_catalog.pg_namespace n
        WHERE nspname NOT LIKE 'pg_%'
          AND nspname != 'information_schema'
        ORDER BY nspname
      `);

      return result.rows.map((row) => ({
        name: row.name,
        comment: row.comment || undefined,
      }));
    } finally {
      client.release();
    }
  }

  async getTables(conn: Connection, schema: string): Promise<TableInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT t.table_name as name,
               t.table_type as type,
               pg_catalog.obj_description(c.oid, 'pg_class') as comment,
               (SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_schema = $1 AND table_name = t.table_name) as column_count
        FROM information_schema.tables t
        JOIN pg_catalog.pg_class c ON c.relname = t.table_name
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE t.table_schema = $1
          AND t.table_name NOT LIKE 'pg_%'
          AND t.table_name NOT LIKE 'sql_%'
        ORDER BY t.table_name
      `, [schema]);

      return result.rows.map((row) => ({
        name: row.name,
        type: row.type === 'VIEW' ? 'view' : 'table',
        comment: row.comment || undefined,
        columnCount: parseInt(row.column_count),
      }));
    } finally {
      client.release();
    }
  }

  async getColumns(conn: Connection, schema: string, table: string): Promise<ColumnInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT column_name as name,
               data_type as type,
               is_nullable = 'YES' as nullable,
               column_default as default_value,
               character_maximum_length as max_length,
               numeric_precision as precision,
               numeric_scale as scale,
               pg_catalog.col_description(c.oid, a.attnum) as comment
        FROM information_schema.columns c
        JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
        JOIN pg_catalog.pg_namespace n ON n.oid = cls.relnamespace
        JOIN pg_catalog.pg_attribute a ON a.attrelid = cls.oid AND a.attname = c.column_name
        WHERE c.table_schema = $1 AND c.table_name = $2
          AND a.attnum > 0  -- exclude system columns
        ORDER BY ordinal_position
      `, [schema, table]);

      return result.rows.map((row) => ({
        name: row.name,
        type: row.type,
        nullable: row.nullable,
        defaultValue: row.default_value || undefined,
        maxLength: row.max_length ? parseInt(row.max_length) : undefined,
        precision: row.precision ? parseInt(row.precision) : undefined,
        scale: row.scale ? parseInt(row.scale) : undefined,
        comment: row.comment || undefined,
        maitreType: this.mapNativeType(row.type),
      }));
    } finally {
      client.release();
    }
  }

  async getIndexes(conn: Connection, schema: string, table: string): Promise<IndexInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT i.relname as name,
               a.amname as type,
               idx.indisprimary as is_primary,
               idx.indisunique as is_unique,
               pg_get_indexdef(idx.indexrelid) as definition
        FROM pg_catalog.pg_index idx
        JOIN pg_catalog.pg_class i ON i.oid = idx.indexrelid
        JOIN pg_catalog.pg_class t ON t.oid = idx.indrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_catalog.pg_am a ON a.oid = i.relam
        WHERE n.nspname = $1 AND t.relname = $2
          AND idx.indisvalid
        ORDER BY i.relname
      `, [schema, table]);

      return result.rows.map((row) => ({
        name: row.name,
        type: row.type,
        isPrimary: row.is_primary,
        isUnique: row.is_unique,
        definition: row.definition,
        columns: this.extractIndexColumns(row.definition),
      }));
    } finally {
      client.release();
    }
  }

  async getFunctions(conn: Connection, schema: string): Promise<FunctionInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT p.proname as name,
               pg_catalog.pg_get_function_result(p.oid) as return_type,
               pg_catalog.pg_get_function_arguments(p.oid) as arguments,
               pg_catalog.obj_description(p.oid, 'pg_proc') as comment,
               l.lanname as language
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_catalog.pg_language l ON l.oid = p.prolang
        WHERE n.nspname = $1
          AND p.proname NOT LIKE 'pg_%'
          AND p.proname NOT LIKE 'sql_%'
        ORDER BY p.proname
      `, [schema]);

      return result.rows.map((row) => ({
        name: row.name,
        returnType: row.return_type,
        arguments: row.arguments,
        comment: row.comment || undefined,
        language: row.language,
      }));
    } finally {
      client.release();
    }
  }

  async getProcedures(conn: Connection, schema: string): Promise<ProcedureInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT p.proname as name,
               pg_catalog.pg_get_function_arguments(p.oid) as arguments,
               pg_catalog.obj_description(p.oid, 'pg_proc') as comment,
               l.lanname as language
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        JOIN pg_catalog.pg_language l ON l.oid = p.prolang
        WHERE n.nspname = $1
          AND p.prokind = 'p'  -- procedure
          AND p.proname NOT LIKE 'pg_%'
          AND p.proname NOT LIKE 'sql_%'
        ORDER BY p.proname
      `, [schema]);

      return result.rows.map((row) => ({
        name: row.name,
        arguments: row.arguments,
        comment: row.comment || undefined,
        language: row.language,
      }));
    } finally {
      client.release();
    }
  }

  async getRoles(conn: Connection): Promise<RoleInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT rolname as name,
               rolsuper as is_superuser,
               rolinherit as can_inherit,
               rolcreaterole as can_create_roles,
               rolcreatedb as can_create_databases,
               rolcanlogin as can_login,
               rolreplication as can_replicate,
               pg_catalog.shobj_description(r.oid, 'pg_authid') as comment
        FROM pg_catalog.pg_roles r
        WHERE rolname NOT LIKE 'pg_%'
        ORDER BY rolname
      `);

      return result.rows.map((row) => ({
        name: row.name,
        isSuperuser: row.is_superuser,
        canInherit: row.can_inherit,
        canCreateRoles: row.can_create_roles,
        canCreateDatabases: row.can_create_databases,
        canLogin: row.can_login,
        canReplicate: row.can_replicate,
        comment: row.comment || undefined,
      }));
    } finally {
      client.release();
    }
  }

  async getGrants(conn: Connection, role?: string): Promise<GrantInfo[]> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const client = await this.pool.connect();
    try {
      let query = `
        SELECT grantee, privilege_type, table_name, schema_name, is_grantable
        FROM information_schema.role_table_grants
      `;

      if (role) {
        query += ` WHERE grantee = $1`;
      }

      query += ` ORDER BY grantee, schema_name, table_name, privilege_type`;

      const result = await client.query(query, role ? [role] : []);

      return result.rows.map((row) => ({
        grantee: row.grantee,
        privilege: row.privilege_type,
        table: row.table_name,
        schema: row.schema_name,
        isGrantable: row.is_grantable,
      }));
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // Query Tracing & Profiling
  // ============================================================================

  async explain(conn: Connection, query: string, options?: ExplainOptions): Promise<ExplainResult> {
    if (!this.pool) {
      throw new MaitreError(
        MaitreErrorCode.CONNECTION_FAILED,
        'PostgreSQL connection not established',
        this.dialect,
      );
    }

    const analyze = options?.analyze ?? false;
    const buffers = options?.buffers ?? false;
    const format = options?.format || 'json';

    let explainQuery = `EXPLAIN (FORMAT ${format.toUpperCase()}`;
    if (analyze) explainQuery += ', ANALYZE';
    if (buffers) explainQuery += ', BUFFERS';
    explainQuery += `) ${query}`;

    const client = await this.pool.connect();
    try {
      const result = await client.query(explainQuery);
      const rawPlan = result.rows[0][format === 'json' ? 'QUERY PLAN' : 'QUERY PLAN'];

      // Parse and normalize the plan
      const normalized = this.normalizeExplainPlan(rawPlan, format);

      return {
        dialect: this.dialect,
        rawPlan,
        plan: normalized,
        totalTimeMs: normalized.timeMs?.actual,
        rowsEstimated: normalized.rows?.estimated,
        rowsActual: normalized.rows?.actual,
        warnings: this.extractExplainWarnings(normalized),
      };
    } finally {
      client.release();
    }
  }

  // ============================================================================
  // Type Mapping
  // ============================================================================

  mapNativeType(nativeType: string): MaitreType {
    const type = nativeType.toLowerCase();
    
    if (type.includes('int') || type.includes('serial')) return 'integer';
    if (type.includes('float') || type.includes('double') || type.includes('real')) return 'float';
    if (type.includes('numeric') || type.includes('decimal') || type.includes('money')) return 'decimal';
    if (type.includes('bool')) return 'boolean';
    if (type.includes('date')) return 'date';
    if (type.includes('time')) return 'time';
    if (type.includes('timestamp')) return 'timestamp';
    if (type.includes('json') || type.includes('jsonb')) return 'json';
    if (type.includes('bytea') || type.includes('blob')) return 'binary';
    if (type.includes('uuid')) return 'uuid';
    if (type.includes('interval')) return 'interval';
    if (type.includes('geometry') || type.includes('geography')) return 'geometry';
    
    // Default to string for text, varchar, char, etc.
    return 'string';
  }

  // ============================================================================
  // Capabilities
  // ============================================================================

  capabilities(): DriverCapabilities {
    return {
      transactions: true,
      streaming: true,
      explain: true,
      explainAnalyze: true,
      procedures: true,
      roles: true,
      schemas: true,
      cancelQuery: true,
      listenNotify: true,
      asyncExecution: false,
      embedded: false,
      costEstimate: true,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private buildPoolConfig(config: ConnectionConfig) {
    const poolConfig: any = {
      host: config.host,
      port: config.port || 5432,
      user: config.user,
      database: config.database,
      password: config.password, // Will be resolved from credential store by caller
      ssl: config.ssl,
      max: config.options?.pool?.max || 10,
      idleTimeoutMillis: config.options?.pool?.idleTimeoutMs || 30000,
      connectionTimeoutMillis: config.options?.pool?.connectTimeoutMs || 5000,
    };

    // Apply SSL configuration
    if (config.ssl) {
      if (typeof config.ssl === 'object') {
        poolConfig.ssl = {
          rejectUnauthorized: config.ssl.rejectUnauthorized !== false,
          ...config.ssl,
        };
      } else if (config.ssl === true) {
        poolConfig.ssl = { rejectUnauthorized: true };
      }
    }

    // Apply connection options
    if (config.options?.applicationName) {
      poolConfig.application_name = config.options.applicationName;
    }
    if (config.options?.statementTimeout) {
      poolConfig.statement_timeout = config.options.statementTimeout;
    }

    return poolConfig;
  }

  private mapQueryResult(result: PgQueryResult, durationMs?: number): QueryResult {
    return {
      rows: result.rows.map((row) => this.mapRow(row)),
      fields: result.fields.map((field) => ({
        name: field.name,
        type: field.dataTypeID,
        maitreType: this.mapNativeType(field.dataTypeName),
      })),
      rowCount: result.rowCount || 0,
      durationMs,
    };
  }

  private mapRow(row: any): Row {
    const mapped: Row = {};
    for (const [key, value] of Object.entries(row)) {
      // Convert PostgreSQL-specific types to JS-friendly formats
      if (value instanceof Buffer) {
        mapped[key] = value.toString('hex');
      } else if (typeof value === 'bigint') {
        mapped[key] = value.toString();
      } else {
        mapped[key] = value;
      }
    }
    return mapped;
  }

  private extractIndexColumns(definition: string): string[] {
    // Extract column names from index definition like:
    // CREATE INDEX idx_name ON table (col1, col2)
    const match = /ON\s+\w+\s*\(([^)]+)\)/i.exec(definition);
    if (!match) return [];
    
    return match[1].split(',').map((col) => col.trim());
  }

  private normalizeExplainPlan(rawPlan: any, format: string): any {
    if (format === 'json') {
      return this.normalizeJsonPlan(rawPlan);
    }
    
    // For text format, return as-is with some metadata
    return {
      operation: 'Plan',
      properties: {
        text: rawPlan,
      },
      children: [],
    };
  }

  private normalizeJsonPlan(plan: any): any {
    // PostgreSQL JSON explain returns an array of nodes
    if (Array.isArray(plan)) {
      if (plan.length === 0) {
        return { operation: 'Empty Plan', children: [] };
      }
      
      // The first node is typically the root
      return this.normalizePlanNode(plan[0]);
    }
    
    return this.normalizePlanNode(plan);
  }

  private normalizePlanNode(node: any): any {
    const normalized: any = {
      operation: node['Node Type'] || 'Unknown',
      properties: { ...node },
      children: [],
    };

    // Extract common properties
    if (node['Actual Total Time']) {
      normalized.timeMs = {
        actual: parseFloat(node['Actual Total Time']),
      };
    }
    
    if (node['Planned Rows'] || node['Actual Rows']) {
      normalized.rows = {
        estimated: node['Planned Rows'] ? parseFloat(node['Planned Rows']) : undefined,
        actual: node['Actual Rows'] ? parseFloat(node['Actual Rows']) : undefined,
      };
    }

    // Recursively normalize children
    if (node.Plans) {
      normalized.children = node.Plans.map((child: any) => this.normalizePlanNode(child));
    }

    delete normalized.properties['Node Type'];
    delete normalized.properties.Plans;

    return normalized;
  }

  private extractExplainWarnings(plan: any): string[] {
    const warnings: string[] = [];
    
    const traverse = (node: any) => {
      if (node.properties?.['Warning']) {
        warnings.push(node.properties['Warning']);
      }
      
      // Check for sequential scans on large tables
      if (node.operation === 'Seq Scan' && node.rows?.estimated > 10000) {
        warnings.push(`Sequential scan on large table (estimated ${node.rows.estimated} rows)`);
      }

      for (const child of node.children || []) {
        traverse(child);
      }
    };

    traverse(plan);
    return warnings;
  }
}
