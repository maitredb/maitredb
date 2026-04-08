[**maitredb v0.0.1**](../../../../README.md)

***

# Class: ConfigManager

Defined in: [packages/core/src/config.ts:61](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L61)

Resolves Maître d'B configuration, connections, and credentials.

## Constructors

### Constructor

> **new ConfigManager**(`options?`): `ConfigManager`

Defined in: [packages/core/src/config.ts:67](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L67)

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

Defined in: [packages/core/src/config.ts:74](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L74)

Lazy-initialized credential manager.

##### Returns

[`CredentialManager`](CredentialManager.md)

## Methods

### getConfig()

> **getConfig**(`overrides?`): [`MaitreConfig`](../interfaces/MaitreConfig.md)

Defined in: [packages/core/src/config.ts:82](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L82)

Load the merged config using the precedence described in the architecture spec.

#### Parameters

##### overrides?

`Partial`\<[`MaitreConfig`](../interfaces/MaitreConfig.md)\>

#### Returns

[`MaitreConfig`](../interfaces/MaitreConfig.md)

***

### getConnection()

> **getConnection**(`name`): `ConnectionConfig`

Defined in: [packages/core/src/config.ts:137](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L137)

Retrieve a connection by name or raise a typed [MaitreError](MaitreError.md).

#### Parameters

##### name

`string`

#### Returns

`ConnectionConfig`

***

### getConnections()

> **getConnections**(): `Record`\<`string`, `ConnectionConfig`\>

Defined in: [packages/core/src/config.ts:128](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L128)

Return every saved connection from both user + project config scopes.

#### Returns

`Record`\<`string`, `ConnectionConfig`\>

***

### getCredential()

> **getCredential**(`connectionName`): `Promise`\<[`Credential`](../type-aliases/Credential.md) \| `undefined`\>

Defined in: [packages/core/src/config.ts:156](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L156)

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

Defined in: [packages/core/src/config.ts:180](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L180)

Remove a saved connection without touching stored credentials.

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### removeConnectionWithCredentials()

> **removeConnectionWithCredentials**(`name`): `Promise`\<`boolean`\>

Defined in: [packages/core/src/config.ts:192](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L192)

Remove a connection and its stored credentials.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`boolean`\>

***

### saveConnection()

> **saveConnection**(`name`, `config`): `void`

Defined in: [packages/core/src/config.ts:168](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L168)

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

Defined in: [packages/core/src/config.ts:163](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/core/src/config.ts#L163)

Store a credential securely. Never writes secrets to connections.json.

#### Parameters

##### connectionName

`string`

##### credential

[`Credential`](../type-aliases/Credential.md)

#### Returns

`Promise`\<`void`\>
