[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: PlanNode

Defined in: [packages/plugin-api/src/types.ts:371](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L371)

## Properties

### children

> **children**: `PlanNode`[]

Defined in: [packages/plugin-api/src/types.ts:378](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L378)

***

### cost?

> `optional` **cost?**: `object`

Defined in: [packages/plugin-api/src/types.ts:375](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L375)

#### startup

> **startup**: `number`

#### total

> **total**: `number`

***

### index?

> `optional` **index?**: `string`

Defined in: [packages/plugin-api/src/types.ts:374](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L374)

***

### operation

> **operation**: `string`

Defined in: [packages/plugin-api/src/types.ts:372](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L372)

***

### properties

> **properties**: `Record`\<`string`, `unknown`\>

Defined in: [packages/plugin-api/src/types.ts:379](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L379)

***

### rows?

> `optional` **rows?**: `object`

Defined in: [packages/plugin-api/src/types.ts:376](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L376)

#### actual?

> `optional` **actual?**: `number`

#### estimated

> **estimated**: `number`

***

### table?

> `optional` **table?**: `string`

Defined in: [packages/plugin-api/src/types.ts:373](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L373)

***

### timeMs?

> `optional` **timeMs?**: `object`

Defined in: [packages/plugin-api/src/types.ts:377](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L377)

#### actual?

> `optional` **actual?**: `number`

#### estimated?

> `optional` **estimated?**: `number`
