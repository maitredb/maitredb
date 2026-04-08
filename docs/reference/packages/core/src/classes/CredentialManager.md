[**maitredb v0.0.1**](../../../../README.md)

***

# Class: CredentialManager

Defined in: [packages/core/src/credentials.ts:421](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L421)

Resolves credentials by walking a chain of backends in priority order:
  1. Environment variables (fastest, no I/O)
  2. Mounted secrets file (if configured)
  3. System keychain (if keytar available)
  4. Encrypted file (always available, pure-JS fallback)

Writes go to the first writable backend (keychain if available, else encrypted file).

## Constructors

### Constructor

> **new CredentialManager**(`options?`): `CredentialManager`

Defined in: [packages/core/src/credentials.ts:424](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L424)

#### Parameters

##### options?

[`CredentialManagerOptions`](../interfaces/CredentialManagerOptions.md)

#### Returns

`CredentialManager`

## Methods

### delete()

> **delete**(`connectionName`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/credentials.ts:483](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L483)

Delete a credential from all backends where it exists.
Returns true if it was deleted from at least one backend.

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<`boolean`\>

***

### get()

> **get**(`connectionName`): `Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

Defined in: [packages/core/src/credentials.ts:443](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L443)

Resolve a credential for a connection by walking the backend chain.
Returns undefined if no credential is found in any backend.

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

***

### list()

> **list**(): `Promise`\<`string`[]\>

Defined in: [packages/core/src/credentials.ts:499](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L499)

List all connection names that have credentials in any backend.

#### Returns

`Promise`\<`string`[]\>

***

### locateBackend()

> **locateBackend**(`connectionName`): `Promise`\<`string` \| `undefined`\>

Defined in: [packages/core/src/credentials.ts:514](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L514)

Get the name of the backend that holds a given credential.
Useful for `mdb connect list` to show where credentials are stored.

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<`string` \| `undefined`\>

***

### store()

> **store**(`connectionName`, `credential`): `Promise`\<`void`\>

Defined in: [packages/core/src/credentials.ts:456](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L456)

Store a credential. Writes to the first available writable backend
(skips environment, which is read-only).

#### Parameters

##### connectionName

`string`

##### credential

[`Credential`](../type-aliases/Credential.md)

#### Returns

`Promise`\<`void`\>
