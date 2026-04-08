[**maitredb v0.0.1**](../../../../README.md)

***

# Class: SqliteDriver

Defined in: [packages/driver-sqlite/src/index.ts:29](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L29)

SQLite driver built on top of better-sqlite3 for in-process speed.

## Implements

- `DriverAdapter`

## Constructors

### Constructor

> **new SqliteDriver**(): `SqliteDriver`

#### Returns

`SqliteDriver`

## Properties

### dialect

> `readonly` **dialect**: `"sqlite"`

Defined in: [packages/driver-sqlite/src/index.ts:30](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L30)

#### Implementation of

`DriverAdapter.dialect`

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `_options?`): `Promise`\<`Transaction`\>

Defined in: [packages/driver-sqlite/src/index.ts:130](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L130)

#### Parameters

##### conn

`Connection`

##### \_options?

`TransactionOptions`

#### Returns

`Promise`\<`Transaction`\>

#### Implementation of

`DriverAdapter.beginTransaction`

***

### cancelQuery()

> **cancelQuery**(`_conn`, `_queryId`): `Promise`\<`void`\>

Defined in: [packages/driver-sqlite/src/index.ts:126](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L126)

#### Parameters

##### \_conn

`Connection`

##### \_queryId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`DriverAdapter.cancelQuery`

***

### capabilities()

> **capabilities**(): `DriverCapabilities`

Defined in: [packages/driver-sqlite/src/index.ts:262](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L262)

#### Returns

`DriverCapabilities`

#### Implementation of

`DriverAdapter.capabilities`

***

### connect()

> **connect**(`config`): `Promise`\<`Connection`\>

Defined in: [packages/driver-sqlite/src/index.ts:32](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L32)

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

Defined in: [packages/driver-sqlite/src/index.ts:46](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L46)

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

Defined in: [packages/driver-sqlite/src/index.ts:82](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L82)

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

> **explain**(`conn`, `query`, `_options?`): `Promise`\<`ExplainResult`\>

Defined in: [packages/driver-sqlite/src/index.ts:232](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L232)

#### Parameters

##### conn

`Connection`

##### query

`string`

##### \_options?

`ExplainOptions`

#### Returns

`Promise`\<`ExplainResult`\>

#### Implementation of

`DriverAdapter.explain`

***

### getColumns()

> **getColumns**(`conn`, `_schema`, `table`): `Promise`\<`ColumnInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:175](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L175)

#### Parameters

##### conn

`Connection`

##### \_schema

`string`

##### table

`string`

#### Returns

`Promise`\<`ColumnInfo`[]\>

#### Implementation of

`DriverAdapter.getColumns`

***

### getFunctions()

> **getFunctions**(`_conn`, `_schema?`): `Promise`\<`FunctionInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:212](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L212)

#### Parameters

##### \_conn

`Connection`

##### \_schema?

`string`

#### Returns

`Promise`\<`FunctionInfo`[]\>

#### Implementation of

`DriverAdapter.getFunctions`

***

### getGrants()

> **getGrants**(`_conn`, `_role?`): `Promise`\<`GrantInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:228](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L228)

#### Parameters

##### \_conn

`Connection`

##### \_role?

`string`

#### Returns

`Promise`\<`GrantInfo`[]\>

#### Implementation of

`DriverAdapter.getGrants`

***

### getIndexes()

> **getIndexes**(`conn`, `_schema`, `table`): `Promise`\<`IndexInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:193](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L193)

#### Parameters

##### conn

`Connection`

##### \_schema

`string`

##### table

`string`

#### Returns

`Promise`\<`IndexInfo`[]\>

#### Implementation of

`DriverAdapter.getIndexes`

***

### getProcedures()

> **getProcedures**(`_conn`, `_schema?`): `Promise`\<`ProcedureInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:216](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L216)

#### Parameters

##### \_conn

`Connection`

##### \_schema?

`string`

#### Returns

`Promise`\<`ProcedureInfo`[]\>

#### Implementation of

`DriverAdapter.getProcedures`

***

### getRoles()

> **getRoles**(`_conn`): `Promise`\<`RoleInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:224](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L224)

#### Parameters

##### \_conn

`Connection`

#### Returns

`Promise`\<`RoleInfo`[]\>

#### Implementation of

`DriverAdapter.getRoles`

***

### getSchemas()

> **getSchemas**(`_conn`): `Promise`\<`SchemaInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:158](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L158)

#### Parameters

##### \_conn

`Connection`

#### Returns

`Promise`\<`SchemaInfo`[]\>

#### Implementation of

`DriverAdapter.getSchemas`

***

### getTables()

> **getTables**(`conn`, `_schema?`): `Promise`\<`TableInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:162](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L162)

#### Parameters

##### conn

`Connection`

##### \_schema?

`string`

#### Returns

`Promise`\<`TableInfo`[]\>

#### Implementation of

`DriverAdapter.getTables`

***

### getTypes()

> **getTypes**(`_conn`, `_schema?`): `Promise`\<`TypeInfo`[]\>

Defined in: [packages/driver-sqlite/src/index.ts:220](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L220)

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

Defined in: [packages/driver-sqlite/src/index.ts:258](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L258)

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

Defined in: [packages/driver-sqlite/src/index.ts:113](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L113)

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

Defined in: [packages/driver-sqlite/src/index.ts:51](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L51)

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

Defined in: [packages/driver-sqlite/src/index.ts:72](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/driver-sqlite/src/index.ts#L72)

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`DriverAdapter.validateConnection`
