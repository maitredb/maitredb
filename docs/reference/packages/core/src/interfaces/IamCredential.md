[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: IamCredential

Defined in: [packages/core/src/credentials.ts:42](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L42)

IAM-based auth — no stored secret, resolved at runtime (AWS IAM, GCP ADC)

## Properties

### kind

> `readonly` **kind**: `"iam"`

Defined in: [packages/core/src/credentials.ts:43](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L43)

***

### profile?

> `readonly` `optional` **profile?**: `string`

Defined in: [packages/core/src/credentials.ts:44](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L44)

***

### roleArn?

> `readonly` `optional` **roleArn?**: `string`

Defined in: [packages/core/src/credentials.ts:45](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L45)
