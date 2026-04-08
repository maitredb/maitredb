[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: GenericPoolFactory\<T\>

Defined in: packages/core/src/generic-pool.ts:4

## Type Parameters

### T

`T`

## Properties

### create

> **create**: () => `Promise`\<`T`\>

Defined in: packages/core/src/generic-pool.ts:5

#### Returns

`Promise`\<`T`\>

***

### destroy

> **destroy**: (`resource`) => `Promise`\<`void`\>

Defined in: packages/core/src/generic-pool.ts:6

#### Parameters

##### resource

`T`

#### Returns

`Promise`\<`void`\>

***

### validate?

> `optional` **validate?**: (`resource`) => `Promise`\<`boolean`\>

Defined in: packages/core/src/generic-pool.ts:7

#### Parameters

##### resource

`T`

#### Returns

`Promise`\<`boolean`\>
