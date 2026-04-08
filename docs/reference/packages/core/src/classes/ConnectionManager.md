[**maitredb v0.0.1**](../../../../README.md)

***

# Class: ConnectionManager

Defined in: packages/core/src/connection-manager.ts:56

Centralized connection lifecycle manager that supports native and generic pools.

## Constructors

### Constructor

> **new ConnectionManager**(`registry`, `configManager`, `options?`): `ConnectionManager`

Defined in: packages/core/src/connection-manager.ts:59

#### Parameters

##### registry

`PluginRegistry`

##### configManager

[`ConfigManager`](ConfigManager.md)

##### options?

[`ConnectionManagerOptions`](../interfaces/ConnectionManagerOptions.md) = `{}`

#### Returns

`ConnectionManager`

## Methods

### closeAll()

> **closeAll**(): `Promise`\<`void`\>

Defined in: packages/core/src/connection-manager.ts:104

Close every managed pool/connection.

#### Returns

`Promise`\<`void`\>

***

### getConnection()

> **getConnection**(`name`): `Promise`\<[`ManagedConnection`](../interfaces/ManagedConnection.md)\>

Defined in: packages/core/src/connection-manager.ts:68

Acquire a managed connection by saved connection name.

#### Parameters

##### name

`string`

#### Returns

`Promise`\<[`ManagedConnection`](../interfaces/ManagedConnection.md)\>

***

### getPoolStats()

> **getPoolStats**(`name`): [`PoolStats`](../interfaces/PoolStats.md) \| `undefined`

Defined in: packages/core/src/connection-manager.ts:120

Return pool counters for generic pools.

#### Parameters

##### name

`string`

#### Returns

[`PoolStats`](../interfaces/PoolStats.md) \| `undefined`

***

### releaseConnection()

> **releaseConnection**(`conn`): `Promise`\<`void`\>

Defined in: packages/core/src/connection-manager.ts:90

Release a managed connection.

#### Parameters

##### conn

[`ManagedConnection`](../interfaces/ManagedConnection.md)

#### Returns

`Promise`\<`void`\>
