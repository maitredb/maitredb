[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ExplainResult

Defined in: [packages/plugin-api/src/types.ts:351](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L351)

## Properties

### dialect

> **dialect**: [`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

Defined in: [packages/plugin-api/src/types.ts:352](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L352)

***

### plan

> **plan**: [`PlanNode`](PlanNode.md)

Defined in: [packages/plugin-api/src/types.ts:354](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L354)

***

### rawPlan

> **rawPlan**: `unknown`

Defined in: [packages/plugin-api/src/types.ts:353](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L353)

***

### rowsActual?

> `optional` **rowsActual?**: `number`

Defined in: [packages/plugin-api/src/types.ts:357](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L357)

***

### rowsEstimated?

> `optional` **rowsEstimated?**: `number`

Defined in: [packages/plugin-api/src/types.ts:356](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L356)

***

### totalTimeMs?

> `optional` **totalTimeMs?**: `number`

Defined in: [packages/plugin-api/src/types.ts:355](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L355)

***

### warnings

> **warnings**: `string`[]

Defined in: [packages/plugin-api/src/types.ts:358](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L358)
