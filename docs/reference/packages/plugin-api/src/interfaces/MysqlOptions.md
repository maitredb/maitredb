[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: MysqlOptions

Defined in: [packages/plugin-api/src/types.ts:125](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L125)

## Properties

### cachePreparedStatements?

> `optional` **cachePreparedStatements?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:137](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L137)

Enable prepared statement caching

***

### charset?

> `optional` **charset?**: `string`

Defined in: [packages/plugin-api/src/types.ts:127](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L127)

Character set, e.g. 'utf8mb4'

***

### connectTimeout?

> `optional` **connectTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:131](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L131)

Connect timeout in ms

***

### localInfile?

> `optional` **localInfile?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:135](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L135)

Enable local LOAD DATA INFILE

***

### multipleStatements?

> `optional` **multipleStatements?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:133](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L133)

Allow multiple statements per query

***

### timezone?

> `optional` **timezone?**: `string`

Defined in: [packages/plugin-api/src/types.ts:129](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L129)

Session timezone, e.g. '+00:00'
