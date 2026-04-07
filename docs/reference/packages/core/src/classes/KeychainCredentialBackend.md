[**maitredb v0.0.1**](../../../../README.md)

***

# Class: KeychainCredentialBackend

Defined in: [packages/core/src/credentials.ts:167](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L167)

Uses the system keychain via `keytar` (optional dependency).
Falls back gracefully if keytar is not installed.

## Implements

- [`CredentialBackend`](../interfaces/CredentialBackend.md)

## Constructors

### Constructor

> **new KeychainCredentialBackend**(): `KeychainCredentialBackend`

#### Returns

`KeychainCredentialBackend`

## Properties

### name

> `readonly` **name**: `"keychain"` = `'keychain'`

Defined in: [packages/core/src/credentials.ts:168](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L168)

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`name`](../interfaces/CredentialBackend.md#name)

## Methods

### delete()

> **delete**(`connectionName`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/credentials.ts:204](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L204)

Delete a credential. Returns true if it existed.

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`delete`](../interfaces/CredentialBackend.md#delete)

***

### get()

> **get**(`connectionName`): `Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

Defined in: [packages/core/src/credentials.ts:175](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L175)

Retrieve a credential by connection name. Returns undefined if not found.

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`get`](../interfaces/CredentialBackend.md#get)

***

### isAvailable()

> **isAvailable**(): `Promise`\<`boolean`\>

Defined in: [packages/core/src/credentials.ts:171](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L171)

Return true if this backend is available in the current environment.

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`isAvailable`](../interfaces/CredentialBackend.md#isavailable)

***

### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [packages/core/src/credentials.ts:210](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L210)

List all connection names that have stored credentials.

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`list`](../interfaces/CredentialBackend.md#list)

***

### store()

> **store**(`connectionName`, `credential`): `Promise`\<`void`\>

Defined in: [packages/core/src/credentials.ts:190](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L190)

Store a credential for a connection. Not all backends support writes.

#### Parameters

##### connectionName

`string`

##### credential

[`Credential`](../type-aliases/Credential.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`store`](../interfaces/CredentialBackend.md#store)
