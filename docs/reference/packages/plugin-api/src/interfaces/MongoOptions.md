[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: MongoOptions

Defined in: [packages/plugin-api/src/types.ts:178](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L178)

## Properties

### appName?

> `optional` **appName?**: `string`

Defined in: [packages/plugin-api/src/types.ts:192](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L192)

Application name for connection metadata

***

### authSource?

> `optional` **authSource?**: `string`

Defined in: [packages/plugin-api/src/types.ts:180](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L180)

Authentication database (default: 'admin')

***

### directConnection?

> `optional` **directConnection?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:188](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L188)

Direct connection to single host (bypass replica set discovery)

***

### readPreference?

> `optional` **readPreference?**: `string`

Defined in: [packages/plugin-api/src/types.ts:186](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L186)

Read preference: primary, secondary, nearest, etc.

***

### replicaSet?

> `optional` **replicaSet?**: `string`

Defined in: [packages/plugin-api/src/types.ts:182](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L182)

Replica set name

***

### srv?

> `optional` **srv?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:184](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L184)

Use SRV DNS resolution (mongodb+srv)

***

### writeConcern?

> `optional` **writeConcern?**: `object`

Defined in: [packages/plugin-api/src/types.ts:190](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L190)

Write concern

#### j?

> `optional` **j?**: `boolean`

#### w?

> `optional` **w?**: `string` \| `number`

#### wtimeout?

> `optional` **wtimeout?**: `number`
