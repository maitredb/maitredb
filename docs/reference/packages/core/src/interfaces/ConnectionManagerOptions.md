[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: ConnectionManagerOptions

Defined in: packages/core/src/connection-manager.ts:31

## Properties

### nativePoolDialects?

> `optional` **nativePoolDialects?**: `Set`\<[`DatabaseDialect`](../../../plugin-api/src/type-aliases/DatabaseDialect.md)\>

Defined in: packages/core/src/connection-manager.ts:34

***

### resolveConnection?

> `optional` **resolveConnection?**: (`name`) => `Promise`\<`ConnectionConfig`\>

Defined in: packages/core/src/connection-manager.ts:32

#### Parameters

##### name

`string`

#### Returns

`Promise`\<`ConnectionConfig`\>

***

### wrapAdapter?

> `optional` **wrapAdapter?**: (`adapter`, `connectionName`) => `DriverAdapter`

Defined in: packages/core/src/connection-manager.ts:33

#### Parameters

##### adapter

`DriverAdapter`

##### connectionName

`string`

#### Returns

`DriverAdapter`
