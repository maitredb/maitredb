[**maitredb v0.0.1**](../../../../README.md)

***

# Class: ConfigManager

Defined in: [packages/core/src/config.ts:45](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L45)

Resolves Maître d'B configuration, connections, and credentials.

## Constructors

### Constructor

> **new ConfigManager**(`options?`): `ConfigManager`

Defined in: [packages/core/src/config.ts:51](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L51)

#### Parameters

##### options?

###### credentialManager?

[`CredentialManagerOptions`](../interfaces/CredentialManagerOptions.md)

#### Returns

`ConfigManager`

## Accessors

### credentials

#### Get Signature

> **get** **credentials**(): [`CredentialManager`](CredentialManager.md)

Defined in: [packages/core/src/config.ts:58](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L58)

Lazy-initialized credential manager.

##### Returns

[`CredentialManager`](CredentialManager.md)

## Methods

### getConfig()

> **getConfig**(`overrides?`): [`MaitreConfig`](../interfaces/MaitreConfig.md)

Defined in: [packages/core/src/config.ts:66](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L66)

Load the merged config using the precedence described in the architecture spec.

#### Parameters

##### overrides?

`Partial`\<[`MaitreConfig`](../interfaces/MaitreConfig.md)\>

#### Returns

[`MaitreConfig`](../interfaces/MaitreConfig.md)

***

### getConnection()

> **getConnection**(`name`): `ConnectionConfig`

Defined in: [packages/core/src/config.ts:103](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L103)

Retrieve a connection by name or raise a typed [MaitreError](MaitreError.md).

#### Parameters

##### name

`string`

#### Returns

`ConnectionConfig`

***

### getConnections()

> **getConnections**(): `Record`\<`string`, `ConnectionConfig`\>

Defined in: [packages/core/src/config.ts:94](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L94)

Return every saved connection from both user + project config scopes.

#### Returns

`Record`\<`string`, `ConnectionConfig`\>

***

### getCredential()

> **getCredential**(`connectionName`): `Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

Defined in: [packages/core/src/config.ts:122](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L122)

Retrieve the credential for a connection from the credential store.
Returns undefined if no credential is stored (e.g. embedded DBs).

#### Parameters

##### connectionName

`string`

#### Returns

`Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

***

### removeConnection()

> **removeConnection**(`name`): `boolean`

Defined in: [packages/core/src/config.ts:145](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L145)

Remove a saved connection without touching stored credentials.

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### removeConnectionWithCredentials()

> **removeConnectionWithCredentials**(`name`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/config.ts:157](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L157)

Remove a connection and its stored credentials.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`boolean`\>

***

### saveConnection()

> **saveConnection**(`name`, `config`): `void`

Defined in: [packages/core/src/config.ts:134](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L134)

Persist a connection definition to the user config directory.

#### Parameters

##### name

`string`

##### config

`ConnectionConfig`

#### Returns

`void`

***

### storeCredential()

> **storeCredential**(`connectionName`, `credential`): `Promise`\<`void`\>

Defined in: [packages/core/src/config.ts:129](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/config.ts#L129)

Store a credential securely. Never writes secrets to connections.json.

#### Parameters

##### connectionName

`string`

##### credential

[`Credential`](../type-aliases/Credential.md)

#### Returns

`Promise`\<`void`\>
