[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: PostgresOptions

Defined in: [packages/plugin-api/src/types.ts:133](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L133)

## Properties

### applicationName?

> `optional` **applicationName?**: `string`

Defined in: [packages/plugin-api/src/types.ts:135](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L135)

Application name reported to pg_stat_activity

***

### binaryResults?

> `optional` **binaryResults?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:143](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L143)

Prefer binary protocol for results

***

### connectTimeout?

> `optional` **connectTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:139](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L139)

Connect timeout in ms

***

### preparedStatementCacheSize?

> `optional` **preparedStatementCacheSize?**: `number`

Defined in: [packages/plugin-api/src/types.ts:145](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L145)

Prepared statement cache size (0 = disabled)

***

### searchPath?

> `optional` **searchPath?**: `string`[]

Defined in: [packages/plugin-api/src/types.ts:141](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L141)

search_path schemas

***

### statementTimeout?

> `optional` **statementTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:137](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L137)

Statement timeout in ms (SET statement_timeout)
