[**maitredb v0.0.1**](../../../../README.md)

***

# Type Alias: DriverOptions

> **DriverOptions** = [`SqliteOptions`](../interfaces/SqliteOptions.md) \| [`PostgresOptions`](../interfaces/PostgresOptions.md) \| [`MysqlOptions`](../interfaces/MysqlOptions.md) \| [`SnowflakeOptions`](../interfaces/SnowflakeOptions.md) \| [`MongoOptions`](../interfaces/MongoOptions.md) \| [`ClickHouseOptions`](../interfaces/ClickHouseOptions.md) \| [`DuckDbOptions`](../interfaces/DuckDbOptions.md) \| [`BigQueryOptions`](../interfaces/BigQueryOptions.md) \| [`RedshiftOptions`](../interfaces/RedshiftOptions.md) \| [`AthenaOptions`](../interfaces/AthenaOptions.md) \| `Record`\<`string`, `unknown`\>

Defined in: [packages/plugin-api/src/types.ts:111](https://github.com/sgoley/maitredb/blob/eb336a8b108b2e051b41d4d911faeb23422b80b7/packages/plugin-api/src/types.ts#L111)

Union of all driver-specific options. Drivers pick the shape matching their dialect.
