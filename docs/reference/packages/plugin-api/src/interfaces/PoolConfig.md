[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: PoolConfig

Defined in: [packages/plugin-api/src/types.ts:70](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L70)

Shared pool configuration for driver-native pools and generic fallback pools.

## Properties

### acquireTimeoutMs?

> `optional` **acquireTimeoutMs?**: `number`

Defined in: [packages/plugin-api/src/types.ts:78](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L78)

Max wait time to acquire a connection in milliseconds.

***

### idleTimeoutMs?

> `optional` **idleTimeoutMs?**: `number`

Defined in: [packages/plugin-api/src/types.ts:76](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L76)

Idle connection timeout in milliseconds.

***

### max?

> `optional` **max?**: `number`

Defined in: [packages/plugin-api/src/types.ts:74](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L74)

Maximum active + idle connections in pool.

***

### maxWaitingClients?

> `optional` **maxWaitingClients?**: `number`

Defined in: [packages/plugin-api/src/types.ts:80](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L80)

Maximum queued acquirers before failing fast.

***

### min?

> `optional` **min?**: `number`

Defined in: [packages/plugin-api/src/types.ts:72](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L72)

Minimum idle connections retained in pool.
