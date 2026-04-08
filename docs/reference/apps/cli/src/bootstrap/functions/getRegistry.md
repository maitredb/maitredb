[**maitredb v0.0.1**](../../../../../README.md)

***

# Function: getRegistry()

> **getRegistry**(): `PluginRegistry`

Defined in: [apps/cli/src/bootstrap.ts:17](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/apps/cli/src/bootstrap.ts#L17)

Resolve the singleton PluginRegistry used by the CLI.
Drivers are registered lazily so simply importing the CLI does not pull
every driver into memory.

## Returns

`PluginRegistry`
