[**maitredb v0.0.1**](../../../../README.md)

***

# Type Alias: DriverOptions

> **DriverOptions** = [`SqliteOptions`](../interfaces/SqliteOptions.md) \| [`PostgresOptions`](../interfaces/PostgresOptions.md) \| [`MysqlOptions`](../interfaces/MysqlOptions.md) \| [`SnowflakeOptions`](../interfaces/SnowflakeOptions.md) \| [`MongoOptions`](../interfaces/MongoOptions.md) \| [`ClickHouseOptions`](../interfaces/ClickHouseOptions.md) \| [`DuckDbOptions`](../interfaces/DuckDbOptions.md) \| [`BigQueryOptions`](../interfaces/BigQueryOptions.md) \| [`RedshiftOptions`](../interfaces/RedshiftOptions.md) \| [`AthenaOptions`](../interfaces/AthenaOptions.md) \| `Record`\<`string`, `unknown`\>

Defined in: [packages/plugin-api/src/types.ts:88](https://github.com/sgoley/maitredb/blob/8ee35fc203da6e50988895a0c2e93182cde94d1d/packages/plugin-api/src/types.ts#L88)

Union of all driver-specific options. Drivers pick the shape matching their dialect.
