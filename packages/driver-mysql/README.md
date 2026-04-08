# @maitredb/driver-mysql

MySQL and MariaDB driver for Maître d'B, built on top of `mysql2`.

## Scope (Phase 1)

- Implements the `DriverAdapter` contract for MySQL-compatible servers
- Supports both `mysql` and `mariadb` connection types
- Streams rows via the mysql2 query stream API
- Introspects schemas/tables/columns/indexes from `information_schema`
- Supports DSN-driven configuration through the CLI parser

## Notes

- Uses pool-based connections (`mysql2.createPool`) for lifecycle and health checks
- Executes parameterized queries via prepared statements when params are provided
