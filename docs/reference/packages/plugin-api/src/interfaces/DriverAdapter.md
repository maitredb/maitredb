[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: DriverAdapter

Defined in: [packages/plugin-api/src/driver-adapter.ts:24](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L24)

Contract that every database driver must implement.

## Properties

### dialect

> `readonly` **dialect**: [`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

Defined in: [packages/plugin-api/src/driver-adapter.ts:25](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L25)

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `options?`): `Promise`\<[`Transaction`](Transaction.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:39](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L39)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### options?

[`TransactionOptions`](TransactionOptions.md)

#### Returns

`Promise`\<[`Transaction`](Transaction.md)\>

***

### cancelQuery()

> **cancelQuery**(`conn`, `queryId`): `Promise`\<`void`\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:36](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L36)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### queryId

`string`

#### Returns

`Promise`\<`void`\>

***

### capabilities()

> **capabilities**(): [`DriverCapabilities`](DriverCapabilities.md)

Defined in: [packages/plugin-api/src/driver-adapter.ts:60](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L60)

#### Returns

[`DriverCapabilities`](DriverCapabilities.md)

***

### connect()

> **connect**(`config`): `Promise`\<[`Connection`](Connection.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:28](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L28)

#### Parameters

##### config

[`ConnectionConfig`](ConnectionConfig.md)

#### Returns

`Promise`\<[`Connection`](Connection.md)\>

***

### disconnect()

> **disconnect**(`conn`): `Promise`\<`void`\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:29](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L29)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<`void`\>

***

### execute()

> **execute**(`conn`, `query`, `params?`): `Promise`\<[`QueryResult`](QueryResult.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:34](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L34)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### query

`string`

##### params?

`unknown`[]

#### Returns

`Promise`\<[`QueryResult`](QueryResult.md)\>

***

### explain()

> **explain**(`conn`, `query`, `options?`): `Promise`\<[`ExplainResult`](ExplainResult.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:54](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L54)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### query

`string`

##### options?

[`ExplainOptions`](ExplainOptions.md)

#### Returns

`Promise`\<[`ExplainResult`](ExplainResult.md)\>

***

### getColumns()

> **getColumns**(`conn`, `schema`, `table`): `Promise`\<[`ColumnInfo`](ColumnInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:44](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L44)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### schema

`string`

##### table

`string`

#### Returns

`Promise`\<[`ColumnInfo`](ColumnInfo.md)[]\>

***

### getFunctions()

> **getFunctions**(`conn`, `schema?`): `Promise`\<[`FunctionInfo`](FunctionInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:46](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L46)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### schema?

`string`

#### Returns

`Promise`\<[`FunctionInfo`](FunctionInfo.md)[]\>

***

### getGrants()

> **getGrants**(`conn`, `role?`): `Promise`\<[`GrantInfo`](GrantInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:51](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L51)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### role?

`string`

#### Returns

`Promise`\<[`GrantInfo`](GrantInfo.md)[]\>

***

### getIndexes()

> **getIndexes**(`conn`, `schema`, `table`): `Promise`\<[`IndexInfo`](IndexInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:45](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L45)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### schema

`string`

##### table

`string`

#### Returns

`Promise`\<[`IndexInfo`](IndexInfo.md)[]\>

***

### getProcedures()

> **getProcedures**(`conn`, `schema?`): `Promise`\<[`ProcedureInfo`](ProcedureInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:47](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L47)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### schema?

`string`

#### Returns

`Promise`\<[`ProcedureInfo`](ProcedureInfo.md)[]\>

***

### getRoles()

> **getRoles**(`conn`): `Promise`\<[`RoleInfo`](RoleInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:50](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L50)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<[`RoleInfo`](RoleInfo.md)[]\>

***

### getSchemas()

> **getSchemas**(`conn`): `Promise`\<[`SchemaInfo`](SchemaInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:42](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L42)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<[`SchemaInfo`](SchemaInfo.md)[]\>

***

### getTables()

> **getTables**(`conn`, `schema?`): `Promise`\<[`TableInfo`](TableInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:43](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L43)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### schema?

`string`

#### Returns

`Promise`\<[`TableInfo`](TableInfo.md)[]\>

***

### mapNativeType()

> **mapNativeType**(`nativeType`): [`MaitreType`](../type-aliases/MaitreType.md)

Defined in: [packages/plugin-api/src/driver-adapter.ts:57](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L57)

#### Parameters

##### nativeType

`string`

#### Returns

[`MaitreType`](../type-aliases/MaitreType.md)

***

### stream()

> **stream**(`conn`, `query`, `params?`): `AsyncIterable`\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:35](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L35)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### query

`string`

##### params?

`unknown`[]

#### Returns

`AsyncIterable`\<`Record`\<`string`, `unknown`\>\>

***

### testConnection()

> **testConnection**(`config`): `Promise`\<[`ConnectionTestResult`](ConnectionTestResult.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:30](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L30)

#### Parameters

##### config

[`ConnectionConfig`](ConnectionConfig.md)

#### Returns

`Promise`\<[`ConnectionTestResult`](ConnectionTestResult.md)\>

***

### validateConnection()

> **validateConnection**(`conn`): `Promise`\<`boolean`\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:31](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/driver-adapter.ts#L31)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<`boolean`\>
