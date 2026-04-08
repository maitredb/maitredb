[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: DriverAdapter

Defined in: [packages/plugin-api/src/driver-adapter.ts:25](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L25)

Contract that every database driver must implement.

## Properties

### dialect

> `readonly` **dialect**: [`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

Defined in: [packages/plugin-api/src/driver-adapter.ts:26](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L26)

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `options?`): `Promise`\<[`Transaction`](Transaction.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:40](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L40)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:37](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L37)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:62](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L62)

#### Returns

[`DriverCapabilities`](DriverCapabilities.md)

***

### connect()

> **connect**(`config`): `Promise`\<[`Connection`](Connection.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:29](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L29)

#### Parameters

##### config

[`ConnectionConfig`](ConnectionConfig.md)

#### Returns

`Promise`\<[`Connection`](Connection.md)\>

***

### disconnect()

> **disconnect**(`conn`): `Promise`\<`void`\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:30](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L30)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<`void`\>

***

### execute()

> **execute**(`conn`, `query`, `params?`): `Promise`\<[`QueryResult`](QueryResult.md)\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:35](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L35)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:56](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L56)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:45](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L45)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:47](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L47)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:53](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L53)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:46](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L46)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:48](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L48)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:52](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L52)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<[`RoleInfo`](RoleInfo.md)[]\>

***

### getSchemas()

> **getSchemas**(`conn`): `Promise`\<[`SchemaInfo`](SchemaInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:43](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L43)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<[`SchemaInfo`](SchemaInfo.md)[]\>

***

### getTables()

> **getTables**(`conn`, `schema?`): `Promise`\<[`TableInfo`](TableInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:44](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L44)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### schema?

`string`

#### Returns

`Promise`\<[`TableInfo`](TableInfo.md)[]\>

***

### getTypes()

> **getTypes**(`conn`, `schema?`): `Promise`\<[`TypeInfo`](TypeInfo.md)[]\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:49](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L49)

#### Parameters

##### conn

[`Connection`](Connection.md)

##### schema?

`string`

#### Returns

`Promise`\<[`TypeInfo`](TypeInfo.md)[]\>

***

### mapNativeType()

> **mapNativeType**(`nativeType`): [`MaitreType`](../type-aliases/MaitreType.md)

Defined in: [packages/plugin-api/src/driver-adapter.ts:59](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L59)

#### Parameters

##### nativeType

`string`

#### Returns

[`MaitreType`](../type-aliases/MaitreType.md)

***

### stream()

> **stream**(`conn`, `query`, `params?`): `AsyncIterable`\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:36](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L36)

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

Defined in: [packages/plugin-api/src/driver-adapter.ts:31](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L31)

#### Parameters

##### config

[`ConnectionConfig`](ConnectionConfig.md)

#### Returns

`Promise`\<[`ConnectionTestResult`](ConnectionTestResult.md)\>

***

### validateConnection()

> **validateConnection**(`conn`): `Promise`\<`boolean`\>

Defined in: [packages/plugin-api/src/driver-adapter.ts:32](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/driver-adapter.ts#L32)

#### Parameters

##### conn

[`Connection`](Connection.md)

#### Returns

`Promise`\<`boolean`\>
