[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: BigQueryOptions

Defined in: [packages/plugin-api/src/types.ts:219](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L219)

## Properties

### defaultDataset?

> `optional` **defaultDataset?**: `string`

Defined in: [packages/plugin-api/src/types.ts:225](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L225)

Default dataset

***

### jobTimeout?

> `optional` **jobTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:229](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L229)

Job timeout in ms

***

### location?

> `optional` **location?**: `string`

Defined in: [packages/plugin-api/src/types.ts:223](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L223)

Dataset location (e.g. 'US', 'EU', 'us-east1')

***

### maximumBytesBilled?

> `optional` **maximumBytesBilled?**: `string`

Defined in: [packages/plugin-api/src/types.ts:227](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L227)

Maximum bytes billed per query (cost control)

***

### projectId

> **projectId**: `string`

Defined in: [packages/plugin-api/src/types.ts:221](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L221)

GCP project ID

***

### useStorageApi?

> `optional` **useStorageApi?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:231](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L231)

Use Storage Read API for Arrow results
