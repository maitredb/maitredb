[**maitredb v0.0.1**](../../../../README.md)

***

# Class: MemoryCache

Defined in: packages/cache/src/memory-cache.ts:11

In-memory LRU cache wrapper used as the fast cache tier.

## Constructors

### Constructor

> **new MemoryCache**(`maxItems`): `MemoryCache`

Defined in: packages/cache/src/memory-cache.ts:16

#### Parameters

##### maxItems

`number`

#### Returns

`MemoryCache`

## Accessors

### stats

#### Get Signature

> **get** **stats**(): [`MemoryCacheStats`](../interfaces/MemoryCacheStats.md)

Defined in: packages/cache/src/memory-cache.ts:64

Return hit/miss counters.

##### Returns

[`MemoryCacheStats`](../interfaces/MemoryCacheStats.md)

## Methods

### clear()

> **clear**(): `void`

Defined in: packages/cache/src/memory-cache.ts:57

Clear the entire cache.

#### Returns

`void`

***

### get()

> **get**\<`T`\>(`key`): `T` \| `undefined`

Defined in: packages/cache/src/memory-cache.ts:23

Retrieve a cached value by key.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### invalidate()

> **invalidate**(`pattern`): `number`

Defined in: packages/cache/src/memory-cache.ts:43

Invalidate keys matching a pattern.

#### Parameters

##### pattern

`RegExp`

#### Returns

`number`

***

### set()

> **set**\<`T`\>(`key`, `value`, `ttlMs`): `void`

Defined in: packages/cache/src/memory-cache.ts:36

Store a value with a TTL in milliseconds.

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

`void`
