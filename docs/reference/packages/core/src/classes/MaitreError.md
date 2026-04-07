[**maitredb v0.0.1**](../../../../README.md)

***

# Class: MaitreError

Defined in: [packages/core/src/errors.ts:43](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/errors.ts#L43)

## Extends

- `Error`

## Constructors

### Constructor

> **new MaitreError**(`code`, `message`, `dialect?`, `nativeCode?`, `suggestion?`): `MaitreError`

Defined in: [packages/core/src/errors.ts:44](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/errors.ts#L44)

#### Parameters

##### code

[`MaitreErrorCode`](../enumerations/MaitreErrorCode.md)

##### message

`string`

##### dialect?

[`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

##### nativeCode?

`string` \| `number`

##### suggestion?

`string`

#### Returns

`MaitreError`

#### Overrides

`Error.constructor`

## Properties

### code

> `readonly` **code**: [`MaitreErrorCode`](../enumerations/MaitreErrorCode.md)

Defined in: [packages/core/src/errors.ts:45](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/errors.ts#L45)

***

### dialect?

> `readonly` `optional` **dialect?**: [`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

Defined in: [packages/core/src/errors.ts:47](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/errors.ts#L47)

***

### nativeCode?

> `readonly` `optional` **nativeCode?**: `string` \| `number`

Defined in: [packages/core/src/errors.ts:48](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/errors.ts#L48)

***

### suggestion?

> `readonly` `optional` **suggestion?**: `string`

Defined in: [packages/core/src/errors.ts:49](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/errors.ts#L49)

## Methods

### toJSON()

> **toJSON**(): `object`

Defined in: [packages/core/src/errors.ts:55](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/core/src/errors.ts#L55)

#### Returns

`object`

##### code

> **code**: [`MaitreErrorCode`](../enumerations/MaitreErrorCode.md)

##### dialect

> **dialect**: [`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md) \| `undefined`

##### error

> **error**: `string`

##### message

> **message**: `string`

##### nativeCode

> **nativeCode**: `string` \| `number` \| `undefined`

##### suggestion

> **suggestion**: `string` \| `undefined`
