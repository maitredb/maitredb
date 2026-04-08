[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: AthenaOptions

Defined in: [packages/plugin-api/src/types.ts:251](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L251)

## Properties

### awsProfile?

> `optional` **awsProfile?**: `string`

Defined in: [packages/plugin-api/src/types.ts:261](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L261)

AWS profile name

***

### catalog?

> `optional` **catalog?**: `string`

Defined in: [packages/plugin-api/src/types.ts:255](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L255)

Data catalog name (default: 'AwsDataCatalog')

***

### outputLocation

> **outputLocation**: `string`

Defined in: [packages/plugin-api/src/types.ts:257](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L257)

S3 output location for query results

***

### queryTimeout?

> `optional` **queryTimeout?**: `number`

Defined in: [packages/plugin-api/src/types.ts:263](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L263)

Query execution timeout in ms

***

### region?

> `optional` **region?**: `string`

Defined in: [packages/plugin-api/src/types.ts:259](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L259)

AWS region

***

### resultReuseEnabled?

> `optional` **resultReuseEnabled?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:265](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L265)

Result reuse (Athena feature)

***

### resultReuseMaxAge?

> `optional` **resultReuseMaxAge?**: `number`

Defined in: [packages/plugin-api/src/types.ts:267](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L267)

Max age for reused results in minutes

***

### workGroup?

> `optional` **workGroup?**: `string`

Defined in: [packages/plugin-api/src/types.ts:253](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L253)

Athena workgroup
