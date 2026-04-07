[**maitredb v0.0.1**](../../../../README.md)

***

# Class: EncryptedFileCredentialBackend

Defined in: [packages/core/src/credentials.ts:273](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L273)

AES-256-GCM encrypted file at `~/.maitredb/credentials.enc`.

Encryption key is derived via PBKDF2 from:
  - Machine fingerprint (hostname + username) — not a secret, prevents portability of stolen files
  - Optional master password — for environments that need stronger protection

The salt is stored in the envelope (per-file, generated once).
Each credential entry has its own IV for independent updates.

## Implements

- [`CredentialBackend`](../interfaces/CredentialBackend.md)

## Constructors

### Constructor

> **new EncryptedFileCredentialBackend**(`options?`): `EncryptedFileCredentialBackend`

Defined in: [packages/core/src/credentials.ts:278](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L278)

#### Parameters

##### options?

###### filePath?

`string`

###### masterPassword?

`string`

#### Returns

`EncryptedFileCredentialBackend`

## Properties

### name

> `readonly` **name**: `"encrypted-file"` = `'encrypted-file'`

Defined in: [packages/core/src/credentials.ts:274](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L274)

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`name`](../interfaces/CredentialBackend.md#name)

## Methods

### delete()

> **delete**(`connectionName`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/credentials.ts:311](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L311)

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

Defined in: [packages/core/src/credentials.ts:287](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L287)

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

Defined in: [packages/core/src/credentials.ts:283](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L283)

Return true if this backend is available in the current environment.

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`isAvailable`](../interfaces/CredentialBackend.md#isavailable)

***

### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [packages/core/src/credentials.ts:320](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L320)

List all connection names that have stored credentials.

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`list`](../interfaces/CredentialBackend.md#list)

***

### store()

> **store**(`connectionName`, `credential`): `Promise`\<`void`\>

Defined in: [packages/core/src/credentials.ts:297](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L297)

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
