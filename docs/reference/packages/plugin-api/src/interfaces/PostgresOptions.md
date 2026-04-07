[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: PostgresOptions

Defined in: [packages/plugin-api/src/types.ts:110](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L110)

## Properties

### applicationName?

> `optional` **applicationName?**: `string`

Defined in: [packages/plugin-api/src/types.ts:112](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L112)

Application name reported to pg_stat_activity

***

### binaryResults?

> `optional` **binaryResults?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:120](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L120)

Prefer binary protocol for results

***

### connectTimeout?

> `optional` **connectTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:116](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L116)

Connect timeout in ms

***

### preparedStatementCacheSize?

> `optional` **preparedStatementCacheSize?**: `number`

Defined in: [packages/plugin-api/src/types.ts:122](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L122)

Prepared statement cache size (0 = disabled)

***

### searchPath?

> `optional` **searchPath?**: `string`[]

Defined in: [packages/plugin-api/src/types.ts:118](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L118)

search_path schemas

***

### statementTimeout?

> `optional` **statementTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:114](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L114)

Statement timeout in ms (SET statement_timeout)
