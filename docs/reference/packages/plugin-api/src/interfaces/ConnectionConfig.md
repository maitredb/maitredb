[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ConnectionConfig

Defined in: [packages/plugin-api/src/types.ts:42](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L42)

## Properties

### auth?

> `optional` **auth?**: [`AuthMethod`](../type-aliases/AuthMethod.md)[]

Defined in: [packages/plugin-api/src/types.ts:58](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L58)

Ordered auth preference — falls through the list until one succeeds.

***

### database?

> `optional` **database?**: `string`

Defined in: [packages/plugin-api/src/types.ts:53](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L53)

***

### host?

> `optional` **host?**: `string`

Defined in: [packages/plugin-api/src/types.ts:45](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L45)

***

### name

> **name**: `string`

Defined in: [packages/plugin-api/src/types.ts:43](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L43)

***

### options?

> `optional` **options?**: [`DriverOptions`](../type-aliases/DriverOptions.md)

Defined in: [packages/plugin-api/src/types.ts:62](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L62)

Driver-specific options — typed per dialect

***

### password?

> `optional` **password?**: `string`

Defined in: [packages/plugin-api/src/types.ts:52](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L52)

Runtime-only password resolved from credential backends.
Must never be persisted to `connections.json`.

***

### path?

> `optional` **path?**: `string`

Defined in: [packages/plugin-api/src/types.ts:55](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L55)

***

### pool?

> `optional` **pool?**: [`PoolConfig`](PoolConfig.md)

Defined in: [packages/plugin-api/src/types.ts:64](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L64)

Connection pooling configuration

***

### port?

> `optional` **port?**: `number`

Defined in: [packages/plugin-api/src/types.ts:46](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L46)

***

### schema?

> `optional` **schema?**: `string`

Defined in: [packages/plugin-api/src/types.ts:56](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L56)

***

### ssl?

> `optional` **ssl?**: `boolean` \| [`SslOptions`](SslOptions.md)

Defined in: [packages/plugin-api/src/types.ts:54](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L54)

***

### tags?

> `optional` **tags?**: `string`[]

Defined in: [packages/plugin-api/src/types.ts:66](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L66)

Connection tags used by governance/history features

***

### tunnel?

> `optional` **tunnel?**: [`TunnelConfig`](TunnelConfig.md)

Defined in: [packages/plugin-api/src/types.ts:60](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L60)

SSH tunnel configuration (v1.0.0+)

***

### type

> **type**: [`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

Defined in: [packages/plugin-api/src/types.ts:44](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L44)

***

### user?

> `optional` **user?**: `string`

Defined in: [packages/plugin-api/src/types.ts:47](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L47)
