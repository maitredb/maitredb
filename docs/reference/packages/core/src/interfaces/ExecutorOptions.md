[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ExecutorOptions

Defined in: [packages/core/src/executor.ts:21](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L21)

Wraps a DriverAdapter to provide consistent error handling and
timing metadata. The executor enforces the "streaming-first" guarantee by
delegating to the driver for both buffered and streamed paths.

## Properties

### cache?

> `optional` **cache?**: `object`

Defined in: [packages/core/src/executor.ts:23](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L23)

#### invalidateForConnection()

> **invalidateForConnection**(`connectionId`, `dialect`, `scope`): `void` \| `Promise`\<`void`\>

##### Parameters

###### connectionId

`string`

###### dialect

`string`

###### scope

`"schema"` \| `"permissions"` \| `"all"`

##### Returns

`void` \| `Promise`\<`void`\>

***

### caller?

> `optional` **caller?**: `"human"` \| `"agent"` \| `"programmatic"`

Defined in: [packages/core/src/executor.ts:35](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L35)

***

### connectionId?

> `optional` **connectionId?**: `string`

Defined in: [packages/core/src/executor.ts:33](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L33)

***

### connectionName?

> `optional` **connectionName?**: `string`

Defined in: [packages/core/src/executor.ts:34](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L34)

***

### history?

> `optional` **history?**: `object`

Defined in: [packages/core/src/executor.ts:30](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L30)

#### record()

> **record**(`entry`): `void` \| `Promise`\<`void`\>

##### Parameters

###### entry

[`AuditEntry`](AuditEntry.md)

##### Returns

`void` \| `Promise`\<`void`\>

***

### logParamsForProduction?

> `optional` **logParamsForProduction?**: `boolean`

Defined in: [packages/core/src/executor.ts:36](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L36)

***

### maxBufferedRows?

> `optional` **maxBufferedRows?**: `number`

Defined in: [packages/core/src/executor.ts:22](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/executor.ts#L22)
