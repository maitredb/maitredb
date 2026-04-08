[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: IamCredential

Defined in: [packages/core/src/credentials.ts:42](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L42)

IAM-based auth — no stored secret, resolved at runtime (AWS IAM, GCP ADC)

## Properties

### kind

> `readonly` **kind**: `"iam"`

Defined in: [packages/core/src/credentials.ts:43](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L43)

***

### profile?

> `readonly` `optional` **profile?**: `string`

Defined in: [packages/core/src/credentials.ts:44](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L44)

***

### roleArn?

> `readonly` `optional` **roleArn?**: `string`

Defined in: [packages/core/src/credentials.ts:45](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L45)
