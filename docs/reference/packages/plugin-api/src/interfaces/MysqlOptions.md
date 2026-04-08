[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: MysqlOptions

Defined in: [packages/plugin-api/src/types.ts:148](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L148)

## Properties

### cachePreparedStatements?

> `optional` **cachePreparedStatements?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:160](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L160)

Enable prepared statement caching

***

### charset?

> `optional` **charset?**: `string`

Defined in: [packages/plugin-api/src/types.ts:150](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L150)

Character set, e.g. 'utf8mb4'

***

### connectTimeout?

> `optional` **connectTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:154](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L154)

Connect timeout in ms

***

### localInfile?

> `optional` **localInfile?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:158](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L158)

Enable local LOAD DATA INFILE

***

### multipleStatements?

> `optional` **multipleStatements?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:156](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L156)

Allow multiple statements per query

***

### timezone?

> `optional` **timezone?**: `string`

Defined in: [packages/plugin-api/src/types.ts:152](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L152)

Session timezone, e.g. '+00:00'
