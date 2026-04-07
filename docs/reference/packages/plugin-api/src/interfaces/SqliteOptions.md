[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: SqliteOptions

Defined in: [packages/plugin-api/src/types.ts:101](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L101)

## Properties

### busyTimeout?

> `optional` **busyTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:107](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L107)

Busy timeout in ms

***

### journalMode?

> `optional` **journalMode?**: `string`

Defined in: [packages/plugin-api/src/types.ts:103](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L103)

WAL, DELETE, TRUNCATE, etc. Default: WAL

***

### mode?

> `optional` **mode?**: `"readonly"` \| `"readwrite"` \| `"memory"`

Defined in: [packages/plugin-api/src/types.ts:105](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L105)

readonly, readwrite, memory
