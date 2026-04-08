[**maitredb v0.0.1**](../../../../../README.md)

***

# Function: resolveConnectionConfig()

> **resolveConnectionConfig**(`configManager`, `connectionName`): `Promise`\<`ConnectionConfig`\>

Defined in: [apps/cli/src/connection-config.ts:13](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/apps/cli/src/connection-config.ts#L13)

Resolve a connection definition to a runtime-ready config by merging:
1. saved connection metadata, and
2. secure credentials from the credential manager.

DSN credentials are parsed and expanded into regular connection fields.

## Parameters

### configManager

`ConfigManager`

### connectionName

`string`

## Returns

`Promise`\<`ConnectionConfig`\>
