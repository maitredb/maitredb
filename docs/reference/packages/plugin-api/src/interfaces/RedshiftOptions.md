[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: RedshiftOptions

Defined in: [packages/plugin-api/src/types.ts:234](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L234)

## Properties

### awsProfile?

> `optional` **awsProfile?**: `string`

Defined in: [packages/plugin-api/src/types.ts:244](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L244)

AWS profile name (for credential resolution)

***

### clusterIdentifier?

> `optional` **clusterIdentifier?**: `string`

Defined in: [packages/plugin-api/src/types.ts:236](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L236)

Redshift cluster identifier (for Data API)

***

### dbUser?

> `optional` **dbUser?**: `string`

Defined in: [packages/plugin-api/src/types.ts:240](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L240)

Database user for IAM-based auth via Data API

***

### region?

> `optional` **region?**: `string`

Defined in: [packages/plugin-api/src/types.ts:242](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L242)

AWS region

***

### secretArn?

> `optional` **secretArn?**: `string`

Defined in: [packages/plugin-api/src/types.ts:248](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L248)

Secrets Manager ARN for credentials

***

### useDirect?

> `optional` **useDirect?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:246](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L246)

Use direct pg wire protocol instead of Data API

***

### workgroupName?

> `optional` **workgroupName?**: `string`

Defined in: [packages/plugin-api/src/types.ts:238](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L238)

Redshift Serverless workgroup name
