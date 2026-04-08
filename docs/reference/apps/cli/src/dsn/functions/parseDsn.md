[**maitredb v0.0.1**](../../../../../README.md)

***

# Function: parseDsn()

> **parseDsn**(`name`, `dsn`): [`ParsedDsn`](../interfaces/ParsedDsn.md)

Defined in: [apps/cli/src/dsn.ts:53](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/apps/cli/src/dsn.ts#L53)

Parse a connection string into a connection config plus an optional
password that should be stored in the credential manager.

## Parameters

### name

`string`

### dsn

`string`

## Returns

[`ParsedDsn`](../interfaces/ParsedDsn.md)
