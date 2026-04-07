[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: AthenaOptions

Defined in: [packages/plugin-api/src/types.ts:228](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L228)

## Properties

### awsProfile?

> `optional` **awsProfile?**: `string`

Defined in: [packages/plugin-api/src/types.ts:238](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L238)

AWS profile name

***

### catalog?

> `optional` **catalog?**: `string`

Defined in: [packages/plugin-api/src/types.ts:232](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L232)

Data catalog name (default: 'AwsDataCatalog')

***

### outputLocation

> **outputLocation**: `string`

Defined in: [packages/plugin-api/src/types.ts:234](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L234)

S3 output location for query results

***

### queryTimeout?

> `optional` **queryTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:240](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L240)

Query execution timeout in ms

***

### region?

> `optional` **region?**: `string`

Defined in: [packages/plugin-api/src/types.ts:236](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L236)

AWS region

***

### resultReuseEnabled?

> `optional` **resultReuseEnabled?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:242](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L242)

Result reuse (Athena feature)

***

### resultReuseMaxAge?

> `optional` **resultReuseMaxAge?**: `number`

Defined in: [packages/plugin-api/src/types.ts:244](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L244)

Max age for reused results in minutes

***

### workGroup?

> `optional` **workGroup?**: `string`

Defined in: [packages/plugin-api/src/types.ts:230](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L230)

Athena workgroup
