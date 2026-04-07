[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: Transaction

Defined in: [packages/plugin-api/src/types.ts:366](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L366)

## Properties

### id

> **id**: `string`

Defined in: [packages/plugin-api/src/types.ts:367](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L367)

## Methods

### commit()

> **commit**(): `Promise`\<`void`\>

Defined in: [packages/plugin-api/src/types.ts:369](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L369)

#### Returns

`Promise`\<`void`\>

***

### query()

> **query**(`sql`, `params?`): `Promise`\<[`QueryResult`](QueryResult.md)\>

Defined in: [packages/plugin-api/src/types.ts:368](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L368)

#### Parameters

##### sql

`string`

##### params?

`unknown`[]

#### Returns

`Promise`\<[`QueryResult`](QueryResult.md)\>

***

### rollback()

> **rollback**(): `Promise`\<`void`\>

Defined in: [packages/plugin-api/src/types.ts:370](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L370)

#### Returns

`Promise`\<`void`\>
