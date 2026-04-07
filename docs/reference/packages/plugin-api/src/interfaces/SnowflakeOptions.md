[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: SnowflakeOptions

Defined in: [packages/plugin-api/src/types.ts:140](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L140)

## Properties

### account

> **account**: `string`

Defined in: [packages/plugin-api/src/types.ts:142](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L142)

Snowflake account identifier (e.g. 'xy12345.us-east-1')

***

### clientSessionKeepAlive?

> `optional` **clientSessionKeepAlive?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:150](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L150)

Client session keep-alive

***

### loginTimeout?

> `optional` **loginTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:148](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L148)

Login timeout in ms

***

### role?

> `optional` **role?**: `string`

Defined in: [packages/plugin-api/src/types.ts:146](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L146)

Default role

***

### sessionParams?

> `optional` **sessionParams?**: `Record`\<`string`, `string`\>

Defined in: [packages/plugin-api/src/types.ts:152](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L152)

Session parameters set at connect time (e.g. QUERY_TAG, TIMEZONE)

***

### warehouse?

> `optional` **warehouse?**: `string`

Defined in: [packages/plugin-api/src/types.ts:144](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L144)

Virtual warehouse
