[**maitredb v0.0.1**](../../../../README.md)

***

# Class: MysqlDriver

Defined in: [packages/driver-mysql/src/index.ts:45](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L45)

Driver adapter for MySQL-compatible engines (`mysql` and `mariadb`) via `mysql2`.

This adapter uses pool-backed connections and supports prepared execution,
stream-based row iteration, `information_schema` introspection, and JSON EXPLAIN.

## Implements

- `DriverAdapter`

## Constructors

### Constructor

> **new MysqlDriver**(`dialect?`): `MysqlDriver`

Defined in: [packages/driver-mysql/src/index.ts:49](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L49)

#### Parameters

##### dialect?

`MysqlDialect` = `'mysql'`

#### Returns

`MysqlDriver`

## Properties

### dialect

> `readonly` **dialect**: `MysqlDialect`

Defined in: [packages/driver-mysql/src/index.ts:47](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L47)

Dialect identity registered in the plugin registry.

#### Implementation of

`DriverAdapter.dialect`

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `options?`): `Promise`\<`Transaction`\>

Defined in: [packages/driver-mysql/src/index.ts:169](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L169)

Begin a transaction and return commit/rollback helpers bound to one connection.

#### Parameters

##### conn

`Connection`

##### options?

`TransactionOptions`

#### Returns

`Promise`\<`Transaction`\>

#### Implementation of

`DriverAdapter.beginTransaction`

***

### cancelQuery()

> **cancelQuery**(`conn`, `queryId`): `Promise`\<`void`\>

Defined in: [packages/driver-mysql/src/index.ts:153](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L153)

Cancel a running query using `KILL QUERY <threadId>`.

#### Parameters

##### conn

`Connection`

##### queryId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`DriverAdapter.cancelQuery`

***

### capabilities()

> **capabilities**(): `DriverCapabilities`

Defined in: [packages/driver-mysql/src/index.ts:570](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L570)

Advertise MySQL/MariaDB capability support to CLI and higher-level tooling.

#### Returns

`DriverCapabilities`

#### Implementation of

`DriverAdapter.capabilities`

***

### connect()

> **connect**(`config`): `Promise`\<`Connection`\>

Defined in: [packages/driver-mysql/src/index.ts:56](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L56)

Connect using a mysql2 pool and return the wrapped Maître d'B connection object.

#### Parameters

##### config

`ConnectionConfig`

#### Returns

`Promise`\<`Connection`\>

#### Implementation of

`DriverAdapter.connect`

***

### disconnect()

> **disconnect**(`conn`): `Promise`\<`void`\>

Defined in: [packages/driver-mysql/src/index.ts:73](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L73)

Close the underlying mysql2 pool.

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`DriverAdapter.disconnect`

***

### execute()

> **execute**(`conn`, `query`, `params?`): `Promise`\<`QueryResult`\>

Defined in: [packages/driver-mysql/src/index.ts:121](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L121)

Execute a SQL statement and buffer rows into a `QueryResult`.

#### Parameters

##### conn

`Connection`

##### query

`string`

##### params?

`unknown`[]

#### Returns

`Promise`\<`QueryResult`\>

#### Implementation of

`DriverAdapter.execute`

***

### explain()

> **explain**(`conn`, `query`, `options?`): `Promise`\<`ExplainResult`\>

Defined in: [packages/driver-mysql/src/index.ts:482](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L482)

Run EXPLAIN and normalize the response into a generic `PlanNode`.

#### Parameters

##### conn

`Connection`

##### query

`string`

##### options?

`ExplainOptions`

#### Returns

`Promise`\<`ExplainResult`\>

#### Implementation of

`DriverAdapter.explain`

***

### getColumns()

> **getColumns**(`conn`, `schema`, `table`): `Promise`\<`ColumnInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:265](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L265)

Describe table columns from `information_schema.columns`.

#### Parameters

##### conn

`Connection`

##### schema

`string`

##### table

`string`

#### Returns

`Promise`\<`ColumnInfo`[]\>

#### Implementation of

`DriverAdapter.getColumns`

***

### getFunctions()

> **getFunctions**(`conn`, `schema?`): `Promise`\<`FunctionInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:342](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L342)

List stored functions from `information_schema.routines`.

#### Parameters

##### conn

`Connection`

##### schema?

`string`

#### Returns

`Promise`\<`FunctionInfo`[]\>

#### Implementation of

`DriverAdapter.getFunctions`

***

### getGrants()

> **getGrants**(`conn`, `role?`): `Promise`\<`GrantInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:441](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L441)

List table grants grouped by grantee/schema/table.

#### Parameters

##### conn

`Connection`

##### role?

`string`

#### Returns

`Promise`\<`GrantInfo`[]\>

#### Implementation of

`DriverAdapter.getGrants`

***

### getIndexes()

> **getIndexes**(`conn`, `schema`, `table`): `Promise`\<`IndexInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:298](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L298)

Describe table indexes from `information_schema.statistics`.

#### Parameters

##### conn

`Connection`

##### schema

`string`

##### table

`string`

#### Returns

`Promise`\<`IndexInfo`[]\>

#### Implementation of

`DriverAdapter.getIndexes`

***

### getProcedures()

> **getProcedures**(`conn`, `schema?`): `Promise`\<`ProcedureInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:370](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L370)

List stored procedures from `information_schema.routines`.

#### Parameters

##### conn

`Connection`

##### schema?

`string`

#### Returns

`Promise`\<`ProcedureInfo`[]\>

#### Implementation of

`DriverAdapter.getProcedures`

***

### getRoles()

> **getRoles**(`conn`): `Promise`\<`RoleInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:404](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L404)

List accounts/roles. Returns an empty list if server permissions disallow role inspection.

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`RoleInfo`[]\>

#### Implementation of

`DriverAdapter.getRoles`

***

### getSchemas()

> **getSchemas**(`conn`): `Promise`\<`SchemaInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:223](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L223)

List logical schemas (databases) from `information_schema.schemata`.

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`SchemaInfo`[]\>

#### Implementation of

`DriverAdapter.getSchemas`

***

### getTables()

> **getTables**(`conn`, `schema?`): `Promise`\<`TableInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:238](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L238)

List tables/views from `information_schema.tables`.

#### Parameters

##### conn

`Connection`

##### schema?

`string`

#### Returns

`Promise`\<`TableInfo`[]\>

#### Implementation of

`DriverAdapter.getTables`

***

### getTypes()

> **getTypes**(`_conn`, `_schema?`): `Promise`\<`TypeInfo`[]\>

Defined in: [packages/driver-mysql/src/index.ts:397](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L397)

MySQL/MariaDB do not expose standalone user-defined type objects.

#### Parameters

##### \_conn

`Connection`

##### \_schema?

`string`

#### Returns

`Promise`\<`TypeInfo`[]\>

#### Implementation of

`DriverAdapter.getTypes`

***

### mapNativeType()

> **mapNativeType**(`nativeType`): `MaitreType`

Defined in: [packages/driver-mysql/src/index.ts:541](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L541)

Map MySQL/MariaDB native type names into the shared `MaitreType` set.

#### Parameters

##### nativeType

`string`

#### Returns

`MaitreType`

#### Implementation of

`DriverAdapter.mapNativeType`

***

### stream()

> **stream**(`conn`, `query`, `params?`): `AsyncIterable`\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/driver-mysql/src/index.ts:139](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L139)

Stream rows without buffering the full result in memory.

#### Parameters

##### conn

`Connection`

##### query

`string`

##### params?

`unknown`[]

#### Returns

`AsyncIterable`\<`Record`\<`string`, `unknown`\>\>

#### Implementation of

`DriverAdapter.stream`

***

### testConnection()

> **testConnection**(`config`): `Promise`\<`ConnectionTestResult`\>

Defined in: [packages/driver-mysql/src/index.ts:81](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L81)

Validate connectivity and return basic latency + server version metadata.

#### Parameters

##### config

`ConnectionConfig`

#### Returns

`Promise`\<`ConnectionTestResult`\>

#### Implementation of

`DriverAdapter.testConnection`

***

### validateConnection()

> **validateConnection**(`conn`): `Promise`\<`boolean`\>

Defined in: [packages/driver-mysql/src/index.ts:109](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-mysql/src/index.ts#L109)

Run a cheap health query (`SELECT 1`) against the active pool.

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`DriverAdapter.validateConnection`
