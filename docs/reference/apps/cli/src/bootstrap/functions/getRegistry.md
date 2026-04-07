[**maitredb v0.0.1**](../../../../../README.md)

***

# Function: getRegistry()

> **getRegistry**(): `PluginRegistry`

Defined in: [apps/cli/src/bootstrap.ts:10](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/apps/cli/src/bootstrap.ts#L10)

Resolve the singleton PluginRegistry used by the CLI.
Drivers are registered lazily so simply importing the CLI does not pull
every driver into memory.

## Returns

`PluginRegistry`
