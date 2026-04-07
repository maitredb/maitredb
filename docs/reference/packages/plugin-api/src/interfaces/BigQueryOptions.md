[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: BigQueryOptions

Defined in: [packages/plugin-api/src/types.ts:196](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L196)

## Properties

### defaultDataset?

> `optional` **defaultDataset?**: `string`

Defined in: [packages/plugin-api/src/types.ts:202](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L202)

Default dataset

***

### jobTimeout?

> `optional` **jobTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:206](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L206)

Job timeout in ms

***

### location?

> `optional` **location?**: `string`

Defined in: [packages/plugin-api/src/types.ts:200](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L200)

Dataset location (e.g. 'US', 'EU', 'us-east1')

***

### maximumBytesBilled?

> `optional` **maximumBytesBilled?**: `string`

Defined in: [packages/plugin-api/src/types.ts:204](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L204)

Maximum bytes billed per query (cost control)

***

### projectId

> **projectId**: `string`

Defined in: [packages/plugin-api/src/types.ts:198](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L198)

GCP project ID

***

### useStorageApi?

> `optional` **useStorageApi?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:208](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L208)

Use Storage Read API for Arrow results
