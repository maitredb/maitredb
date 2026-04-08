[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: SqliteOptions

Defined in: [packages/plugin-api/src/types.ts:124](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L124)

## Properties

### busyTimeout?

> `optional` **busyTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:130](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L130)

Busy timeout in ms

***

### journalMode?

> `optional` **journalMode?**: `string`

Defined in: [packages/plugin-api/src/types.ts:126](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L126)

WAL, DELETE, TRUNCATE, etc. Default: WAL

***

### mode?

> `optional` **mode?**: `"readonly"` \| `"readwrite"` \| `"memory"`

Defined in: [packages/plugin-api/src/types.ts:128](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L128)

readonly, readwrite, memory
