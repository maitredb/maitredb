[**maitredb v0.0.1**](../../../../README.md)

***

# Class: HistoryStore

Defined in: packages/core/src/history.ts:39

Persistent query history/audit store backed by optional better-sqlite3.

## Constructors

### Constructor

> **new HistoryStore**(`options?`): `HistoryStore`

Defined in: packages/core/src/history.ts:45

#### Parameters

##### options?

[`HistoryStoreOptions`](../interfaces/HistoryStoreOptions.md) = `{}`

#### Returns

`HistoryStore`

## Methods

### close()

> **close**(): `void`

Defined in: packages/core/src/history.ts:202

Close underlying database handle when present.

#### Returns

`void`

***

### isAvailable()

> **isAvailable**(): `boolean`

Defined in: packages/core/src/history.ts:86

True when history backend is available and enabled.

#### Returns

`boolean`

***

### maybeRotate()

> **maybeRotate**(`maxSizeMb?`): `void`

Defined in: packages/core/src/history.ts:178

Rotate store by deleting the oldest 20% of rows if file exceeds max size.

#### Parameters

##### maxSizeMb?

`number` = `...`

#### Returns

`void`

***

### query()

> **query**(`options?`): [`AuditEntry`](../interfaces/AuditEntry.md)[]

Defined in: packages/core/src/history.ts:125

Query recent history entries.

#### Parameters

##### options?

[`HistoryQueryOptions`](../interfaces/HistoryQueryOptions.md) = `{}`

#### Returns

[`AuditEntry`](../interfaces/AuditEntry.md)[]

***

### record()

> **record**(`entry`): `void`

Defined in: packages/core/src/history.ts:93

Persist one audit entry.

#### Parameters

##### entry

[`AuditEntry`](../interfaces/AuditEntry.md)

#### Returns

`void`
