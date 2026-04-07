[**maitredb v0.0.1**](../../../../README.md)

***

# Class: PluginRegistry

Defined in: [packages/plugin-api/src/registry.ts:7](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/registry.ts#L7)

Central registry that lazy-loads driver adapters on demand.

## Constructors

### Constructor

> **new PluginRegistry**(): `PluginRegistry`

#### Returns

`PluginRegistry`

## Accessors

### dialects

#### Get Signature

> **get** **dialects**(): [`DatabaseDialect`](../type-aliases/DatabaseDialect.md)[]

Defined in: [packages/plugin-api/src/registry.ts:42](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/registry.ts#L42)

List of all dialects with registered adapters or factories.

##### Returns

[`DatabaseDialect`](../type-aliases/DatabaseDialect.md)[]

## Methods

### get()

> **get**(`dialect`): `Promise`\<[`DriverAdapter`](../interfaces/DriverAdapter.md)\>

Defined in: [packages/plugin-api/src/registry.ts:22](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/registry.ts#L22)

Resolve (and cache) the adapter for the requested dialect.

#### Parameters

##### dialect

[`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

#### Returns

`Promise`\<[`DriverAdapter`](../interfaces/DriverAdapter.md)\>

***

### has()

> **has**(`dialect`): `boolean`

Defined in: [packages/plugin-api/src/registry.ts:37](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/registry.ts#L37)

True when a driver or factory has been registered for the dialect.

#### Parameters

##### dialect

[`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

#### Returns

`boolean`

***

### register()

> **register**(`dialect`, `adapter`): `void`

Defined in: [packages/plugin-api/src/registry.ts:17](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/registry.ts#L17)

Register an already-instantiated adapter (useful for tests).

#### Parameters

##### dialect

[`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

##### adapter

[`DriverAdapter`](../interfaces/DriverAdapter.md)

#### Returns

`void`

***

### registerFactory()

> **registerFactory**(`dialect`, `factory`): `void`

Defined in: [packages/plugin-api/src/registry.ts:12](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/registry.ts#L12)

Register a factory function that produces a driver when requested.

#### Parameters

##### dialect

[`DatabaseDialect`](../type-aliases/DatabaseDialect.md)

##### factory

`DriverFactory`

#### Returns

`void`
