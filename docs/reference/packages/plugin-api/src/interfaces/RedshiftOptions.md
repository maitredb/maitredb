[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: RedshiftOptions

Defined in: [packages/plugin-api/src/types.ts:211](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L211)

## Properties

### awsProfile?

> `optional` **awsProfile?**: `string`

Defined in: [packages/plugin-api/src/types.ts:221](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L221)

AWS profile name (for credential resolution)

***

### clusterIdentifier?

> `optional` **clusterIdentifier?**: `string`

Defined in: [packages/plugin-api/src/types.ts:213](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L213)

Redshift cluster identifier (for Data API)

***

### dbUser?

> `optional` **dbUser?**: `string`

Defined in: [packages/plugin-api/src/types.ts:217](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L217)

Database user for IAM-based auth via Data API

***

### region?

> `optional` **region?**: `string`

Defined in: [packages/plugin-api/src/types.ts:219](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L219)

AWS region

***

### secretArn?

> `optional` **secretArn?**: `string`

Defined in: [packages/plugin-api/src/types.ts:225](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L225)

Secrets Manager ARN for credentials

***

### useDirect?

> `optional` **useDirect?**: `boolean`

Defined in: [packages/plugin-api/src/types.ts:223](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L223)

Use direct pg wire protocol instead of Data API

***

### workgroupName?

> `optional` **workgroupName?**: `string`

Defined in: [packages/plugin-api/src/types.ts:215](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/plugin-api/src/types.ts#L215)

Redshift Serverless workgroup name
