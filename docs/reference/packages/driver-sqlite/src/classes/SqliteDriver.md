[**maitredb v0.0.1**](../../../../README.md)

***

# Class: SqliteDriver

Defined in: [packages/driver-sqlite/src/index.ts:28](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L28)

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

Defined in: [packages/driver-sqlite/src/index.ts:29](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L29)

#### Implementation of

`DriverAdapter.dialect`

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `_options?`): `Promise`\<`Transaction`\>

Defined in: [packages/driver-sqlite/src/index.ts:129](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L129)

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

Defined in: [packages/driver-sqlite/src/index.ts:125](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L125)

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

Defined in: [packages/driver-sqlite/src/index.ts:257](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L257)

#### Returns

`DriverCapabilities`

#### Implementation of

`DriverAdapter.capabilities`

***

### connect()

> **connect**(`config`): `Promise`\<`Connection`\>

Defined in: [packages/driver-sqlite/src/index.ts:31](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L31)

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

Defined in: [packages/driver-sqlite/src/index.ts:45](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L45)

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

Defined in: [packages/driver-sqlite/src/index.ts:81](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L81)

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

Defined in: [packages/driver-sqlite/src/index.ts:227](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L227)

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

Defined in: [packages/driver-sqlite/src/index.ts:174](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L174)

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

Defined in: [packages/driver-sqlite/src/index.ts:211](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L211)

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

Defined in: [packages/driver-sqlite/src/index.ts:223](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L223)

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

Defined in: [packages/driver-sqlite/src/index.ts:192](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L192)

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

Defined in: [packages/driver-sqlite/src/index.ts:215](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L215)

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

Defined in: [packages/driver-sqlite/src/index.ts:219](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L219)

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

Defined in: [packages/driver-sqlite/src/index.ts:157](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L157)

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

Defined in: [packages/driver-sqlite/src/index.ts:161](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L161)

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

### mapNativeType()

> **mapNativeType**(`nativeType`): `MaitreType`

Defined in: [packages/driver-sqlite/src/index.ts:253](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L253)

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

Defined in: [packages/driver-sqlite/src/index.ts:112](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L112)

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

Defined in: [packages/driver-sqlite/src/index.ts:50](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L50)

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

Defined in: [packages/driver-sqlite/src/index.ts:71](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-sqlite/src/index.ts#L71)

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`DriverAdapter.validateConnection`
