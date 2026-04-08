[**maitredb v0.0.1**](../../../../README.md)

***

# Function: invalidationPattern()

> **invalidationPattern**(`connectionId`, `dialect`, `scope`): `RegExp`

Defined in: packages/cache/src/cache-key.ts:21

Build a regular expression used to invalidate keys by scope.

## Parameters

### connectionId

`string`

### dialect

[`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

### scope

`"schema"` \| `"permissions"` \| `"all"`

## Returns

`RegExp`
