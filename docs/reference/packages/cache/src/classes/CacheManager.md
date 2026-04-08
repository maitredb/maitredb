[**maitredb v0.0.1**](../../../../README.md)

***

# Class: CacheManager

Defined in: packages/cache/src/cache-manager.ts:22

Two-tier cache manager (memory + optional disk).

## Constructors

### Constructor

> **new CacheManager**(`options?`): `CacheManager`

Defined in: packages/cache/src/cache-manager.ts:27

#### Parameters

##### options?

`CacheOptions` = `{}`

#### Returns

`CacheManager`

## Methods

### buildKey()

> **buildKey**(`connectionId`, `dialect`, `operation`, `schema?`, `object?`): `string`

Defined in: packages/cache/src/cache-manager.ts:126

Build canonical key format for callers.

#### Parameters

##### connectionId

`string`

##### dialect

[`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

##### operation

`string`

##### schema?

`string`

##### object?

`string`

#### Returns

`string`

***

### clear()

> **clear**(): `void`

Defined in: packages/cache/src/cache-manager.ts:139

Clear all cache tiers.

#### Returns

`void`

***

### close()

> **close**(): `void`

Defined in: packages/cache/src/cache-manager.ts:147

Close optional resources.

#### Returns

`void`

***

### get()

> **get**\<`T`\>(`key`): `Promise`\<`T` \| `undefined`\>

Defined in: packages/cache/src/cache-manager.ts:55

Resolve a key from memory first, then disk.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`T` \| `undefined`\>

***

### getOrSet()

> **getOrSet**\<`T`\>(`key`, `ttlMs`, `loader`): `Promise`\<`T`\>

Defined in: packages/cache/src/cache-manager.ts:90

Resolve from cache or load from source and populate cache.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### ttlMs

`number`

##### loader

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### invalidate()

> **invalidate**(`pattern`): `Promise`\<`void`\>

Defined in: packages/cache/src/cache-manager.ts:104

Invalidate keys matching a regex pattern.

#### Parameters

##### pattern

`RegExp`

#### Returns

`Promise`\<`void`\>

***

### invalidateForConnection()

> **invalidateForConnection**(`connectionId`, `dialect`, `scope`): `Promise`\<`void`\>

Defined in: packages/cache/src/cache-manager.ts:115

Invalidate schema/permission cache entries for one connection.

#### Parameters

##### connectionId

`string`

##### dialect

[`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

##### scope

`"schema"` \| `"permissions"` \| `"all"`

#### Returns

`Promise`\<`void`\>

***

### isEnabled()

> **isEnabled**(): `boolean`

Defined in: packages/cache/src/cache-manager.ts:41

Return true when caching is enabled by configuration.

#### Returns

`boolean`

***

### set()

> **set**\<`T`\>(`key`, `value`, `ttlMs`): `Promise`\<`void`\>

Defined in: packages/cache/src/cache-manager.ts:80

Write key/value pair to configured cache tiers.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

##### value

`T`

##### ttlMs

`number`

#### Returns

`Promise`\<`void`\>

***

### ttlFor()

> **ttlFor**(`scope`): `number`

Defined in: packages/cache/src/cache-manager.ts:48

Return cache TTL for a metadata scope.

#### Parameters

##### scope

`"schema"` \| `"permissions"`

#### Returns

`number`
