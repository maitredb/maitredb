[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: DuckDbOptions

Defined in: [packages/plugin-api/src/types.ts:185](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L185)

## Properties

### accessMode?

> `optional` **accessMode?**: `"automatic"` \| `"read_only"` \| `"read_write"`

Defined in: [packages/plugin-api/src/types.ts:193](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L193)

Access mode

***

### extensions?

> `optional` **extensions?**: `string`[]

Defined in: [packages/plugin-api/src/types.ts:191](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L191)

Extensions to auto-load on connect

***

### memoryLimit?

> `optional` **memoryLimit?**: `string`

Defined in: [packages/plugin-api/src/types.ts:187](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L187)

Maximum memory usage (e.g. '4GB')

***

### threads?

> `optional` **threads?**: `number`

Defined in: [packages/plugin-api/src/types.ts:189](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L189)

Number of threads (0 = auto)
