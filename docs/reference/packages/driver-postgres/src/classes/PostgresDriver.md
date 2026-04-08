[**maitredb v0.0.1**](../../../../README.md)

***

# Class: PostgresDriver

Defined in: [packages/driver-postgres/src/index.ts:34](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L34)

PostgreSQL driver implemented via the native `pg` client.

## Implements

- `DriverAdapter`

## Constructors

### Constructor

> **new PostgresDriver**(): `PostgresDriver`

Defined in: [packages/driver-postgres/src/index.ts:39](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L39)

#### Returns

`PostgresDriver`

## Properties

### dialect

> `readonly` **dialect**: `"postgresql"` = `'postgresql'`

Defined in: [packages/driver-postgres/src/index.ts:35](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L35)

#### Implementation of

`DriverAdapter.dialect`

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `options?`): `Promise`\<`Transaction`\>

Defined in: [packages/driver-postgres/src/index.ts:187](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L187)

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

Defined in: [packages/driver-postgres/src/index.ts:164](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L164)

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

Defined in: [packages/driver-postgres/src/index.ts:594](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L594)

#### Returns

`DriverCapabilities`

#### Implementation of

`DriverAdapter.capabilities`

***

### connect()

> **connect**(`config`): `Promise`\<`Connection`\>

Defined in: [packages/driver-postgres/src/index.ts:49](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L49)

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

Defined in: [packages/driver-postgres/src/index.ts:61](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L61)

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

Defined in: [packages/driver-postgres/src/index.ts:123](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L123)

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

Defined in: [packages/driver-postgres/src/index.ts:526](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L526)

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

Defined in: [packages/driver-postgres/src/index.ts:286](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L286)

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

> **getFunctions**(`conn`, `schema`): `Promise`\<`FunctionInfo`[]\>

Defined in: [packages/driver-postgres/src/index.ts:371](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L371)

#### Parameters

##### conn

`Connection`

##### schema

`string`

#### Returns

`Promise`\<`FunctionInfo`[]\>

#### Implementation of

`DriverAdapter.getFunctions`

***

### getGrants()

> **getGrants**(`conn`, `role?`): `Promise`\<`GrantInfo`[]\>

Defined in: [packages/driver-postgres/src/index.ts:486](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L486)

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

Defined in: [packages/driver-postgres/src/index.ts:331](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L331)

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

> **getProcedures**(`conn`, `schema`): `Promise`\<`ProcedureInfo`[]\>

Defined in: [packages/driver-postgres/src/index.ts:409](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L409)

#### Parameters

##### conn

`Connection`

##### schema

`string`

#### Returns

`Promise`\<`ProcedureInfo`[]\>

#### Implementation of

`DriverAdapter.getProcedures`

***

### getRoles()

> **getRoles**(`conn`): `Promise`\<`RoleInfo`[]\>

Defined in: [packages/driver-postgres/src/index.ts:446](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L446)

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

Defined in: [packages/driver-postgres/src/index.ts:220](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L220)

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`SchemaInfo`[]\>

#### Implementation of

`DriverAdapter.getSchemas`

***

### getTables()

> **getTables**(`conn`, `schema`): `Promise`\<`TableInfo`[]\>

Defined in: [packages/driver-postgres/src/index.ts:249](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L249)

#### Parameters

##### conn

`Connection`

##### schema

`string`

#### Returns

`Promise`\<`TableInfo`[]\>

#### Implementation of

`DriverAdapter.getTables`

***

### mapNativeType()

> **mapNativeType**(`nativeType`): `MaitreType`

Defined in: [packages/driver-postgres/src/index.ts:570](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L570)

#### Parameters

##### nativeType

`string`

#### Returns

`MaitreType`

#### Implementation of

`DriverAdapter.mapNativeType`

***

### stream()

> **stream**(`conn`, `query`, `params?`): `AsyncIterable`\<`Row`\>

Defined in: [packages/driver-postgres/src/index.ts:144](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L144)

#### Parameters

##### conn

`Connection`

##### query

`string`

##### params?

`unknown`[]

#### Returns

`AsyncIterable`\<`Row`\>

#### Implementation of

`DriverAdapter.stream`

***

### testConnection()

> **testConnection**(`config`): `Promise`\<`ConnectionTestResult`\>

Defined in: [packages/driver-postgres/src/index.ts:68](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L68)

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

Defined in: [packages/driver-postgres/src/index.ts:104](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/driver-postgres/src/index.ts#L104)

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`DriverAdapter.validateConnection`
