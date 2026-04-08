[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: PlanNode

Defined in: [packages/plugin-api/src/types.ts:340](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L340)

## Properties

### children

> **children**: `PlanNode`[]

Defined in: [packages/plugin-api/src/types.ts:347](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L347)

***

### cost?

> `optional` **cost?**: `object`

Defined in: [packages/plugin-api/src/types.ts:344](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L344)

#### startup

> **startup**: `number`

#### total

> **total**: `number`

***

### index?

> `optional` **index?**: `string`

Defined in: [packages/plugin-api/src/types.ts:343](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L343)

***

### operation

> **operation**: `string`

Defined in: [packages/plugin-api/src/types.ts:341](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L341)

***

### properties

> **properties**: `Record`\<`string`, `unknown`\>

Defined in: [packages/plugin-api/src/types.ts:348](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L348)

***

### rows?

> `optional` **rows?**: `object`

Defined in: [packages/plugin-api/src/types.ts:345](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L345)

#### actual?

> `optional` **actual?**: `number`

#### estimated

> **estimated**: `number`

***

### table?

> `optional` **table?**: `string`

Defined in: [packages/plugin-api/src/types.ts:342](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L342)

***

### timeMs?

> `optional` **timeMs?**: `object`

Defined in: [packages/plugin-api/src/types.ts:346](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L346)

#### actual?

> `optional` **actual?**: `number`

#### estimated?

> `optional` **estimated?**: `number`
