[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: DuckDbOptions

Defined in: [packages/plugin-api/src/types.ts:208](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L208)

## Properties

### accessMode?

> `optional` **accessMode?**: `"automatic"` \| `"read_only"` \| `"read_write"`

Defined in: [packages/plugin-api/src/types.ts:216](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L216)

Access mode

***

### extensions?

> `optional` **extensions?**: `string`[]

Defined in: [packages/plugin-api/src/types.ts:214](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L214)

Extensions to auto-load on connect

***

### memoryLimit?

> `optional` **memoryLimit?**: `string`

Defined in: [packages/plugin-api/src/types.ts:210](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L210)

Maximum memory usage (e.g. '4GB')

***

### threads?

> `optional` **threads?**: `number`

Defined in: [packages/plugin-api/src/types.ts:212](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L212)

Number of threads (0 = auto)
