[**maitredb v0.0.1**](../../../../README.md)

***

# Class: GenericPool\<T\>

Defined in: packages/core/src/generic-pool.ts:30

Generic async pool used for drivers that do not provide native pool support.

## Type Parameters

### T

`T`

## Constructors

### Constructor

> **new GenericPool**\<`T`\>(`factory`, `config`): `GenericPool`\<`T`\>

Defined in: packages/core/src/generic-pool.ts:38

#### Parameters

##### factory

[`GenericPoolFactory`](../interfaces/GenericPoolFactory.md)\<`T`\>

##### config

`Required`\<`PoolConfig`\>

#### Returns

`GenericPool`\<`T`\>

## Accessors

### stats

#### Get Signature

> **get** **stats**(): [`PoolStats`](../interfaces/PoolStats.md)

Defined in: packages/core/src/generic-pool.ts:161

Current pool counters.

##### Returns

[`PoolStats`](../interfaces/PoolStats.md)

## Methods

### acquire()

> **acquire**(): `Promise`\<`T`\>

Defined in: packages/core/src/generic-pool.ts:48

Acquire a pooled resource, waiting up to `acquireTimeoutMs` if pool is saturated.

#### Returns

`Promise`\<`T`\>

***

### drain()

> **drain**(): `Promise`\<`void`\>

Defined in: packages/core/src/generic-pool.ts:126

Drain and close all resources in this pool.

#### Returns

`Promise`\<`void`\>

***

### invalidate()

> **invalidate**(`resource`): `Promise`\<`void`\>

Defined in: packages/core/src/generic-pool.ts:105

Remove a resource from the pool immediately (for failed health checks).

#### Parameters

##### resource

`T`

#### Returns

`Promise`\<`void`\>

***

### release()

> **release**(`resource`): `Promise`\<`void`\>

Defined in: packages/core/src/generic-pool.ts:78

Return a resource back to the pool.

#### Parameters

##### resource

`T`

#### Returns

`Promise`\<`void`\>
