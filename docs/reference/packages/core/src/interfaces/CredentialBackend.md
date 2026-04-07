[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: CredentialBackend

Defined in: [packages/core/src/credentials.ts:66](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L66)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [packages/core/src/credentials.ts:67](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L67)

## Methods

### delete()

> **delete**(`connectionName`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/credentials.ts:79](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L79)

Delete a credential. Returns true if it existed.

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<`boolean`\>

***

### get()

> **get**(`connectionName`): `Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

Defined in: [packages/core/src/credentials.ts:73](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L73)

Retrieve a credential by connection name. Returns undefined if not found.

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

***

### isAvailable()

> **isAvailable**(): `Promise`\<`boolean`\>

Defined in: [packages/core/src/credentials.ts:70](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L70)

Return true if this backend is available in the current environment.

#### Returns

`Promise`\<`boolean`\>

***

### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [packages/core/src/credentials.ts:82](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L82)

List all connection names that have stored credentials.

#### Returns

`Promise`\<`string`[]\>

***

### store()

> **store**(`connectionName`, `credential`): `Promise`\<`void`\>

Defined in: [packages/core/src/credentials.ts:76](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L76)

Store a credential for a connection. Not all backends support writes.

#### Parameters

##### connectionName

`string`

##### credential

[`Credential`](../type-aliases/Credential.md)

#### Returns

`Promise`\<`void`\>
