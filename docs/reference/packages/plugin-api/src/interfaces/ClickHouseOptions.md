[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ClickHouseOptions

Defined in: [packages/plugin-api/src/types.ts:195](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L195)

## Properties

### compression?

> `optional` **compression?**: `"none"` \| `"lz4"` \| `"zstd"`

Defined in: [packages/plugin-api/src/types.ts:201](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L201)

Enable compression (lz4, zstd)

***

### protocol?

> `optional` **protocol?**: `"http"` \| `"https"` \| `"native"`

Defined in: [packages/plugin-api/src/types.ts:197](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L197)

Connection protocol

***

### requestTimeout?

> `optional` **requestTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:199](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L199)

Request timeout in ms

***

### resultFormat?

> `optional` **resultFormat?**: `"JSON"` \| `"JSONEachRow"` \| `"ArrowStream"`

Defined in: [packages/plugin-api/src/types.ts:205](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L205)

Preferred result format

***

### sessionSettings?

> `optional` **sessionSettings?**: `Record`\<`string`, `string`\>

Defined in: [packages/plugin-api/src/types.ts:203](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L203)

ClickHouse settings applied per session
