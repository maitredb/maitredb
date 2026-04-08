[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ExplainResult

Defined in: [packages/plugin-api/src/types.ts:382](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L382)

## Properties

### dialect

> **dialect**: [`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

Defined in: [packages/plugin-api/src/types.ts:383](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L383)

***

### plan

> **plan**: [`PlanNode`](PlanNode.md)

Defined in: [packages/plugin-api/src/types.ts:385](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L385)

***

### rawPlan

> **rawPlan**: `unknown`

Defined in: [packages/plugin-api/src/types.ts:384](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L384)

***

### rowsActual?

> `optional` **rowsActual?**: `number`

Defined in: [packages/plugin-api/src/types.ts:388](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L388)

***

### rowsEstimated?

> `optional` **rowsEstimated?**: `number`

Defined in: [packages/plugin-api/src/types.ts:387](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L387)

***

### totalTimeMs?

> `optional` **totalTimeMs?**: `number`

Defined in: [packages/plugin-api/src/types.ts:386](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L386)

***

### warnings

> **warnings**: `string`[]

Defined in: [packages/plugin-api/src/types.ts:389](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L389)
