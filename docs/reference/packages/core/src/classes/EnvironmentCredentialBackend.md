[**maitredb v0.0.1**](../../../../README.md)

***

# Class: EnvironmentCredentialBackend

Defined in: [packages/core/src/credentials.ts:100](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L100)

Reads credentials from environment variables.

Supported patterns:
  MDB_CONN_<NAME>_PASSWORD  → PasswordCredential
  MDB_CONN_<NAME>_DSN       → DsnCredential
  MDB_CONN_<NAME>_TOKEN     → TokenCredential
  MDB_CONN_<NAME>_KEY_FILE  → ServiceAccountCredential

Connection name is upper-cased and hyphens become underscores.

## Implements

- [`CredentialBackend`](../interfaces/CredentialBackend.md)

## Constructors

### Constructor

> **new EnvironmentCredentialBackend**(): `EnvironmentCredentialBackend`

#### Returns

`EnvironmentCredentialBackend`

## Properties

### name

> `readonly` **name**: `"environment"` = `'environment'`

Defined in: [packages/core/src/credentials.ts:101](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L101)

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`name`](../interfaces/CredentialBackend.md#name)

## Methods

### delete()

> **delete**(`_connectionName`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/credentials.ts:132](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L132)

Delete a credential. Returns true if it existed.

#### Parameters

##### \_connectionName

`string`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`delete`](../interfaces/CredentialBackend.md#delete)

***

### get()

> **get**(`connectionName`): `Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

Defined in: [packages/core/src/credentials.ts:107](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L107)

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

Defined in: [packages/core/src/credentials.ts:103](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L103)

Return true if this backend is available in the current environment.

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`isAvailable`](../interfaces/CredentialBackend.md#isavailable)

***

### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [packages/core/src/credentials.ts:136](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L136)

List all connection names that have stored credentials.

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`list`](../interfaces/CredentialBackend.md#list)

***

### store()

> **store**(`_connectionName`, `_credential`): `Promise`\<`void`\>

Defined in: [packages/core/src/credentials.ts:125](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/credentials.ts#L125)

Store a credential for a connection. Not all backends support writes.

#### Parameters

##### \_connectionName

`string`

##### \_credential

[`Credential`](../type-aliases/Credential.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CredentialBackend`](../interfaces/CredentialBackend.md).[`store`](../interfaces/CredentialBackend.md#store)
