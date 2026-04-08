[**maitredb v0.0.1**](../../../../README.md)

***

# Class: QueryExecutor

Defined in: [packages/core/src/executor.ts:39](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L39)

## Constructors

### Constructor

> **new QueryExecutor**(`adapter`, `options?`): `QueryExecutor`

Defined in: [packages/core/src/executor.ts:42](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L42)

#### Parameters

##### adapter

`DriverAdapter`

##### options?

[`ExecutorOptions`](../interfaces/ExecutorOptions.md) = `{}`

#### Returns

`QueryExecutor`

## Methods

### execute()

> **execute**(`conn`, `sql`, `params?`): `Promise`\<`QueryResult`\>

Defined in: [packages/core/src/executor.ts:50](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L50)

Execute a SQL statement and capture timing metadata.

#### Parameters

##### conn

`Connection`

##### sql

`string`

##### params?

`unknown`[]

#### Returns

`Promise`\<`QueryResult`\>

***

### stream()

> **stream**(`conn`, `sql`, `params?`): `AsyncIterable`\<`Record`\<`string`, `unknown`\>\>

Defined in: [packages/core/src/executor.ts:96](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L96)

Stream rows directly from the adapter while preserving error semantics.

#### Parameters

##### conn

`Connection`

##### sql

`string`

##### params?

`unknown`[]

#### Returns

`AsyncIterable`\<`Record`\<`string`, `unknown`\>\>
