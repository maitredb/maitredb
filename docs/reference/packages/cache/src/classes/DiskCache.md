[**maitredb v0.0.1**](../../../../README.md)

***

# Class: DiskCache

Defined in: packages/cache/src/disk-cache.ts:27

Optional disk-backed cache layer implemented with better-sqlite3.

## Constructors

### Constructor

> **new DiskCache**(`dbPath`, `databaseCtor?`): `DiskCache`

Defined in: packages/cache/src/disk-cache.ts:30

#### Parameters

##### dbPath

`string`

##### databaseCtor?

`BetterSqlite3Ctor` \| `null`

#### Returns

`DiskCache`

## Methods

### clear()

> **clear**(): `void`

Defined in: packages/cache/src/disk-cache.ts:135

Remove all cached disk rows.

#### Returns

`void`

***

### close()

> **close**(): `void`

Defined in: packages/cache/src/disk-cache.ts:143

Close the underlying sqlite database handle.

#### Returns

`void`

***

### get()

> **get**\<`T`\>(`key`): [`DiskCacheValue`](../interfaces/DiskCacheValue.md)\<`T`\> \| `undefined`

Defined in: packages/cache/src/disk-cache.ts:59

Read a non-expired key from disk.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`string`

#### Returns

[`DiskCacheValue`](../interfaces/DiskCacheValue.md)\<`T`\> \| `undefined`

***

### invalidate()

> **invalidate**(`prefix`): `number`

Defined in: packages/cache/src/disk-cache.ts:107

Invalidate all keys with the provided string prefix.

#### Parameters

##### prefix

`string`

#### Returns

`number`

***

### invalidateByRegex()

> **invalidateByRegex**(`pattern`): `number`

Defined in: packages/cache/src/disk-cache.ts:115

Invalidate keys matching a regular expression.

#### Parameters

##### pattern

`RegExp`

#### Returns

`number`

***

### isAvailable()

> **isAvailable**(): `boolean`

Defined in: packages/cache/src/disk-cache.ts:52

Return true when the disk backend is available.

#### Returns

`boolean`

***

### set()

> **set**\<`T`\>(`key`, `value`, `ttlMs`): `void`

Defined in: packages/cache/src/disk-cache.ts:89

Upsert one key/value pair on disk with TTL.

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
