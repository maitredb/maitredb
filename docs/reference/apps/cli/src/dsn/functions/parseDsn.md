[**maitredb v0.0.1**](../../../../../README.md)

***

# Function: parseDsn()

> **parseDsn**(`name`, `dsn`): [`ParsedDsn`](../interfaces/ParsedDsn.md)

Defined in: [apps/cli/src/dsn.ts:62](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/apps/cli/src/dsn.ts#L62)

Parse a connection string into a connection config plus an optional
password that should be stored in the credential manager.

## Parameters

### name

`string`

### dsn

`string`

## Returns

[`ParsedDsn`](../interfaces/ParsedDsn.md)
