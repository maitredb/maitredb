[**maitredb v0.0.1**](../../../../README.md)

***

# Class: PostgresDriver

Defined in: packages/driver-postgres/src/index.ts:34

PostgreSQL driver implemented via the native `pg` client.

## Implements

- `DriverAdapter`

## Constructors

### Constructor

> **new PostgresDriver**(): `PostgresDriver`

Defined in: packages/driver-postgres/src/index.ts:39

#### Returns

`PostgresDriver`

## Properties

### dialect

> `readonly` **dialect**: `"postgresql"` = `'postgresql'`

Defined in: packages/driver-postgres/src/index.ts:35

#### Implementation of

`DriverAdapter.dialect`

## Methods

### beginTransaction()

> **beginTransaction**(`conn`, `options?`): `Promise`\<`Transaction`\>

Defined in: packages/driver-postgres/src/index.ts:187

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

Defined in: packages/driver-postgres/src/index.ts:164

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

Defined in: packages/driver-postgres/src/index.ts:594

#### Returns

`DriverCapabilities`

#### Implementation of

`DriverAdapter.capabilities`

***

### connect()

> **connect**(`config`): `Promise`\<`Connection`\>

Defined in: packages/driver-postgres/src/index.ts:49

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

Defined in: packages/driver-postgres/src/index.ts:61

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

Defined in: packages/driver-postgres/src/index.ts:123

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

Defined in: packages/driver-postgres/src/index.ts:526

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

Defined in: packages/driver-postgres/src/index.ts:286

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

Defined in: packages/driver-postgres/src/index.ts:371

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

Defined in: packages/driver-postgres/src/index.ts:486

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

Defined in: packages/driver-postgres/src/index.ts:331

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

Defined in: packages/driver-postgres/src/index.ts:409

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

Defined in: packages/driver-postgres/src/index.ts:446

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

Defined in: packages/driver-postgres/src/index.ts:220

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

Defined in: packages/driver-postgres/src/index.ts:249

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

Defined in: packages/driver-postgres/src/index.ts:570

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

Defined in: packages/driver-postgres/src/index.ts:144

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

Defined in: packages/driver-postgres/src/index.ts:68

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

Defined in: packages/driver-postgres/src/index.ts:104

#### Parameters

##### conn

`Connection`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`DriverAdapter.validateConnection`
