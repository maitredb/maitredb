[**maitredb v0.0.1**](../../../../README.md)

***

# Class: PostgresDriver

Defined in: [packages/driver-postgres/src/index.ts:31](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L31)

PostgreSQL driver implemented via the native `pg` client.

## Implements

- `DriverAdapter`

## Constructors

### Constructor

> **new PostgresDriver**(): `PostgresDriver`

Defined in: [packages/driver-postgres/src/index.ts:34](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L34)

#### Returns

`PostgresDriver`

## Properties

### dialect

> `readonly` **dialect**: `"postgresql"` = `'postgresql'`

Defined in: [packages/driver-postgres/src/index.ts:32](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L32)

#### Implementation of

`DriverAdapter.dialect`

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `options?`): `Promise`\<`Transaction`\>

Defined in: [packages/driver-postgres/src/index.ts:131](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L131)

Begin a transaction and return helpers bound to one client session.

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

Defined in: [packages/driver-postgres/src/index.ts:115](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L115)

Cancel a backend query by PID using `pg_cancel_backend`.

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

Defined in: [packages/driver-postgres/src/index.ts:561](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L561)

Expose PostgreSQL feature flags for CLI/runtime gating.

#### Returns

`DriverCapabilities`

#### Implementation of

`DriverAdapter.capabilities`

***

### connect()

> **connect**(`config`): `Promise`\<`Connection`\>

Defined in: [packages/driver-postgres/src/index.ts:42](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L42)

Create a pooled PostgreSQL connection and validate with `SELECT 1`.

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

Defined in: [packages/driver-postgres/src/index.ts:57](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L57)

Dispose the underlying `pg.Pool`.

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

Defined in: [packages/driver-postgres/src/index.ts:97](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L97)

Execute a SQL statement and return buffered rows + field metadata.

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

Defined in: [packages/driver-postgres/src/index.ts:495](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L495)

Run EXPLAIN and normalize the returned plan tree.

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

Defined in: [packages/driver-postgres/src/index.ts:219](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L219)

List columns with PK/nullability/default metadata.

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

Defined in: [packages/driver-postgres/src/index.ts:321](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L321)

List SQL functions.

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

Defined in: [packages/driver-postgres/src/index.ts:457](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L457)

List table grants grouped as one row per role/schema/table.

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

Defined in: [packages/driver-postgres/src/index.ts:279](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L279)

List indexes and ordered index columns for a table.

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

Defined in: [packages/driver-postgres/src/index.ts:356](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L356)

List stored procedures.

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

Defined in: [packages/driver-postgres/src/index.ts:434](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L434)

List roles/users visible to the caller.

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

Defined in: [packages/driver-postgres/src/index.ts:174](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L174)

List non-system schemas.

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

Defined in: [packages/driver-postgres/src/index.ts:187](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L187)

List tables/views with optional schema filtering.

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

> **getTypes**(`conn`, `schema?`): `Promise`\<`TypeInfo`[]\>

Defined in: [packages/driver-postgres/src/index.ts:388](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L388)

List user-defined PostgreSQL types (enum/composite/domain/range/base).

#### Parameters

##### conn

`Connection`

##### schema?

`string`

#### Returns

`Promise`\<`TypeInfo`[]\>

#### Implementation of

`DriverAdapter.getTypes`

***

### mapNativeType()

> **mapNativeType**(`nativeType`): `MaitreType`

Defined in: [packages/driver-postgres/src/index.ts:537](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L537)

Map PostgreSQL native type names to the shared type system.

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

Defined in: [packages/driver-postgres/src/index.ts:106](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L106)

Stream rows as an `AsyncIterable` without changing the caller contract.

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

Defined in: [packages/driver-postgres/src/index.ts:62](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L62)

Probe database reachability and server version.

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

Defined in: [packages/driver-postgres/src/index.ts:87](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-postgres/src/index.ts#L87)

Execute a lightweight health query for an existing connection.

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`DriverAdapter.validateConnection`
