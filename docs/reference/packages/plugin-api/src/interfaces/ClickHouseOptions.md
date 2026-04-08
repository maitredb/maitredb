[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ClickHouseOptions

Defined in: [packages/plugin-api/src/types.ts:172](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L172)

## Properties

### compression?

> `optional` **compression?**: `"none"` \| `"lz4"` \| `"zstd"`

Defined in: [packages/plugin-api/src/types.ts:178](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L178)

Enable compression (lz4, zstd)

***

### protocol?

> `optional` **protocol?**: `"http"` \| `"https"` \| `"native"`

Defined in: [packages/plugin-api/src/types.ts:174](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L174)

Connection protocol

***

### requestTimeout?

> `optional` **requestTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:176](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L176)

Request timeout in ms

***

### resultFormat?

> `optional` **resultFormat?**: `"JSON"` \| `"JSONEachRow"` \| `"ArrowStream"`

Defined in: [packages/plugin-api/src/types.ts:182](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L182)

Preferred result format

***

### sessionSettings?

> `optional` **sessionSettings?**: `Record`\<`string`, `string`\>

Defined in: [packages/plugin-api/src/types.ts:180](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L180)

ClickHouse settings applied per session
