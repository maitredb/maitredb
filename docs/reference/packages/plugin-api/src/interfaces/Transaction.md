[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: Transaction

Defined in: [packages/plugin-api/src/types.ts:397](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L397)

## Properties

### id

> **id**: `string`

Defined in: [packages/plugin-api/src/types.ts:398](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L398)

## Methods

### commit()

> **commit**(): `Promise`\<`void`\>

Defined in: [packages/plugin-api/src/types.ts:400](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L400)

#### Returns

`Promise`\<`void`\>

***

### query()

> **query**(`sql`, `params?`): `Promise`\<[`QueryResult`](QueryResult.md)\>

Defined in: [packages/plugin-api/src/types.ts:399](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L399)

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

Defined in: [packages/plugin-api/src/types.ts:401](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L401)

#### Returns

`Promise`\<`void`\>
