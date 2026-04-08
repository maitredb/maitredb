[**maitredb v0.0.1**](../../../../../README.md)

***

# Function: getRegistry()

> **getRegistry**(): `PluginRegistry`

Defined in: [apps/cli/src/bootstrap.ts:10](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/apps/cli/src/bootstrap.ts#L10)

Resolve the singleton PluginRegistry used by the CLI.
Drivers are registered lazily so simply importing the CLI does not pull
every driver into memory.

## Returns

`PluginRegistry`
