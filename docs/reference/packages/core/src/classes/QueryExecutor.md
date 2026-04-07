[**maitredb v0.0.1**](../../../../README.md)

***

# Class: QueryExecutor

Defined in: [packages/core/src/executor.ts:18](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/executor.ts#L18)

Wraps a DriverAdapter to provide consistent error handling and
timing metadata. The executor enforces the "streaming-first" guarantee by
delegating to the driver for both buffered and streamed paths.

## Constructors

### Constructor

> **new QueryExecutor**(`adapter`, `maxBufferedRows?`): `QueryExecutor`

Defined in: [packages/core/src/executor.ts:19](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/executor.ts#L19)

#### Parameters

##### adapter

`DriverAdapter`

##### maxBufferedRows?

`number` = `DEFAULT_MAX_BUFFERED_ROWS`

#### Returns

`QueryExecutor`

## Methods

### execute()

> **execute**(`conn`, `sql`, `params?`): `Promise`\<`QueryResult`\>

Defined in: [packages/core/src/executor.ts:25](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/executor.ts#L25)

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

Defined in: [packages/core/src/executor.ts:37](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/executor.ts#L37)

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
