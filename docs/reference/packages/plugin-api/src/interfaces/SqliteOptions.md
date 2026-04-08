[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: SqliteOptions

Defined in: [packages/plugin-api/src/types.ts:101](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L101)

## Properties

### busyTimeout?

> `optional` **busyTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:107](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L107)

Busy timeout in ms

***

### journalMode?

> `optional` **journalMode?**: `string`

Defined in: [packages/plugin-api/src/types.ts:103](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L103)

WAL, DELETE, TRUNCATE, etc. Default: WAL

***

### mode?

> `optional` **mode?**: `"readonly"` \| `"readwrite"` \| `"memory"`

Defined in: [packages/plugin-api/src/types.ts:105](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L105)

readonly, readwrite, memory
