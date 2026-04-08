[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: MongoOptions

Defined in: [packages/plugin-api/src/types.ts:155](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L155)

## Properties

### appName?

> `optional` **appName?**: `string`

Defined in: [packages/plugin-api/src/types.ts:169](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L169)

Application name for connection metadata

***

### authSource?

> `optional` **authSource?**: `string`

Defined in: [packages/plugin-api/src/types.ts:157](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L157)

Authentication database (default: 'admin')

***

### directConnection?

> `optional` **directConnection?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:165](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L165)

Direct connection to single host (bypass replica set discovery)

***

### readPreference?

> `optional` **readPreference?**: `string`

Defined in: [packages/plugin-api/src/types.ts:163](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L163)

Read preference: primary, secondary, nearest, etc.

***

### replicaSet?

> `optional` **replicaSet?**: `string`

Defined in: [packages/plugin-api/src/types.ts:159](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L159)

Replica set name

***

### srv?

> `optional` **srv?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:161](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L161)

Use SRV DNS resolution (mongodb+srv)

***

### writeConcern?

> `optional` **writeConcern?**: `object`

Defined in: [packages/plugin-api/src/types.ts:167](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L167)

Write concern

#### j?

> `optional` **j?**: `boolean`

#### w?

> `optional` **w?**: `string` \| `number`

#### wtimeout?

> `optional` **wtimeout?**: `number`
