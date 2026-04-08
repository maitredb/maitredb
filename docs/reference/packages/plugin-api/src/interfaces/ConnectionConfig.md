[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ConnectionConfig

Defined in: [packages/plugin-api/src/types.ts:42](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L42)

## Properties

### auth?

> `optional` **auth?**: [`AuthMethod`](../type-aliases/AuthMethod.md)[]

Defined in: [packages/plugin-api/src/types.ts:53](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L53)

Ordered auth preference — falls through the list until one succeeds.

***

### database?

> `optional` **database?**: `string`

Defined in: [packages/plugin-api/src/types.ts:48](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L48)

***

### host?

> `optional` **host?**: `string`

Defined in: [packages/plugin-api/src/types.ts:45](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L45)

***

### name

> **name**: `string`

Defined in: [packages/plugin-api/src/types.ts:43](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L43)

***

### options?

> `optional` **options?**: [`DriverOptions`](../type-aliases/DriverOptions.md)

Defined in: [packages/plugin-api/src/types.ts:57](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L57)

Driver-specific options — typed per dialect

***

### path?

> `optional` **path?**: `string`

Defined in: [packages/plugin-api/src/types.ts:50](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L50)

***

### port?

> `optional` **port?**: `number`

Defined in: [packages/plugin-api/src/types.ts:46](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L46)

***

### schema?

> `optional` **schema?**: `string`

Defined in: [packages/plugin-api/src/types.ts:51](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L51)

***

### ssl?

> `optional` **ssl?**: `boolean` \| [`SslOptions`](SslOptions.md)

Defined in: [packages/plugin-api/src/types.ts:49](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L49)

***

### tunnel?

> `optional` **tunnel?**: [`TunnelConfig`](TunnelConfig.md)

Defined in: [packages/plugin-api/src/types.ts:55](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L55)

SSH tunnel configuration (v1.0.0+)

***

### type

> **type**: [`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

Defined in: [packages/plugin-api/src/types.ts:44](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L44)

***

### user?

> `optional` **user?**: `string`

Defined in: [packages/plugin-api/src/types.ts:47](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L47)
