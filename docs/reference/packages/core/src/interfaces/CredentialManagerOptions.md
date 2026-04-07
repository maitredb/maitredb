[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: CredentialManagerOptions

Defined in: [packages/core/src/credentials.ts:403](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L403)

## Properties

### backends?

> `optional` **backends?**: [`CredentialBackend`](CredentialBackend.md)[]

Defined in: [packages/core/src/credentials.ts:405](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L405)

Override the default backend chain.

***

### credentialsFile?

> `optional` **credentialsFile?**: `string`

Defined in: [packages/core/src/credentials.ts:409](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L409)

Path to a mounted secrets file (Kubernetes / Docker).

***

### masterPassword?

> `optional` **masterPassword?**: `string`

Defined in: [packages/core/src/credentials.ts:407](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L407)

Master password for the encrypted file backend.
