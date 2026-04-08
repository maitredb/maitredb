[**maitredb v0.0.1**](../../../../README.md)

***

# Class: CachedAdapter

Defined in: packages/cache/src/cached-adapter.ts:28

DriverAdapter proxy that caches metadata/permission introspection calls.

## Implements

- `DriverAdapter`

## Constructors

### Constructor

> **new CachedAdapter**(`inner`, `cache`): `CachedAdapter`

Defined in: packages/cache/src/cached-adapter.ts:29

#### Parameters

##### inner

`DriverAdapter`

##### cache

[`CacheManager`](CacheManager.md)

#### Returns

`CachedAdapter`

## Accessors

### dialect

#### Get Signature

> **get** **dialect**(): [`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

Defined in: packages/cache/src/cached-adapter.ts:34

##### Returns

[`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

#### Implementation of

`DriverAdapter.dialect`

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `options?`): `Promise`\<`Transaction`\>

Defined in: packages/cache/src/cached-adapter.ts:66

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

Defined in: packages/cache/src/cached-adapter.ts:62

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

Defined in: packages/cache/src/cached-adapter.ts:177

#### Returns

`DriverCapabilities`

#### Implementation of

`DriverAdapter.capabilities`

***

### connect()

> **connect**(`config`): `Promise`\<`Connection`\>

Defined in: packages/cache/src/cached-adapter.ts:38

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

Defined in: packages/cache/src/cached-adapter.ts:42

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

Defined in: packages/cache/src/cached-adapter.ts:54

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

Defined in: packages/cache/src/cached-adapter.ts:169

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

Defined in: packages/cache/src/cached-adapter.ts:92

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

Defined in: packages/cache/src/cached-adapter.ts:114

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

Defined in: packages/cache/src/cached-adapter.ts:158

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

Defined in: packages/cache/src/cached-adapter.ts:103

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

Defined in: packages/cache/src/cached-adapter.ts:125

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

Defined in: packages/cache/src/cached-adapter.ts:147

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

Defined in: packages/cache/src/cached-adapter.ts:70

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

Defined in: packages/cache/src/cached-adapter.ts:81

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

Defined in: packages/cache/src/cached-adapter.ts:136

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

Defined in: packages/cache/src/cached-adapter.ts:173

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

Defined in: packages/cache/src/cached-adapter.ts:58

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

Defined in: packages/cache/src/cached-adapter.ts:46

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

Defined in: packages/cache/src/cached-adapter.ts:50

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`DriverAdapter.validateConnection`
