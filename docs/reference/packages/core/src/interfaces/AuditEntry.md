[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: AuditEntry

Defined in: packages/core/src/types.ts:7

One query/audit record persisted to local history storage.

## Properties

### caller

> **caller**: `"human"` \| `"agent"` \| `"programmatic"`

Defined in: packages/core/src/types.ts:12

***

### connection

> **connection**: `string`

Defined in: packages/core/src/types.ts:10

***

### dialect

> **dialect**: [`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)

Defined in: packages/core/src/types.ts:11

***

### durationMs

> **durationMs**: `number`

Defined in: packages/core/src/types.ts:15

***

### error?

> `optional` **error?**: `object`

Defined in: packages/core/src/types.ts:18

#### code

> **code**: [`MaitreErrorCode`](../enumerations/MaitreErrorCode.md)

#### message

> **message**: `string`

***

### id

> **id**: `string`

Defined in: packages/core/src/types.ts:8

***

### params?

> `optional` **params?**: `unknown`[]

Defined in: packages/core/src/types.ts:14

***

### policyApplied?

> `optional` **policyApplied?**: `string`

Defined in: packages/core/src/types.ts:22

***

### query

> **query**: `string`

Defined in: packages/core/src/types.ts:13

***

### rowsAffected?

> `optional` **rowsAffected?**: `number`

Defined in: packages/core/src/types.ts:16

***

### rowsReturned?

> `optional` **rowsReturned?**: `number`

Defined in: packages/core/src/types.ts:17

***

### timestamp

> **timestamp**: `Date`

Defined in: packages/core/src/types.ts:9
