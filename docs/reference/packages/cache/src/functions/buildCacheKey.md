[**maitredb v0.0.1**](../../../../README.md)

***

# Function: buildCacheKey()

> **buildCacheKey**(`connectionId`, `dialect`, `operation`, `schema?`, `object?`): `string`

Defined in: packages/cache/src/cache-key.ts:6

Build a canonical cache key for metadata and permission operations.

## Parameters

### connectionId

`string`

### dialect

[`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

### operation

`string`

### schema?

`string`

### object?

`string`

## Returns

`string`
