[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: SnowflakeOptions

Defined in: [packages/plugin-api/src/types.ts:163](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L163)

## Properties

### account

> **account**: `string`

Defined in: [packages/plugin-api/src/types.ts:165](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L165)

Snowflake account identifier (e.g. 'xy12345.us-east-1')

***

### clientSessionKeepAlive?

> `optional` **clientSessionKeepAlive?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:173](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L173)

Client session keep-alive

***

### loginTimeout?

> `optional` **loginTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:171](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L171)

Login timeout in ms

***

### role?

> `optional` **role?**: `string`

Defined in: [packages/plugin-api/src/types.ts:169](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L169)

Default role

***

### sessionParams?

> `optional` **sessionParams?**: `Record`\<`string`, `string`\>

Defined in: [packages/plugin-api/src/types.ts:175](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L175)

Session parameters set at connect time (e.g. QUERY_TAG, TIMEZONE)

***

### warehouse?

> `optional` **warehouse?**: `string`

Defined in: [packages/plugin-api/src/types.ts:167](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L167)

Virtual warehouse
