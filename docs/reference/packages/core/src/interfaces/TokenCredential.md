[**maitredb v0.0.1**](../../../../README.md)

***

# Interface: TokenCredential

Defined in: [packages/core/src/credentials.ts:25](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L25)

OAuth / SSO token with optional refresh (Snowflake SSO, BigQuery, etc.)

## Properties

### accessToken

> `readonly` **accessToken**: `string`

Defined in: [packages/core/src/credentials.ts:27](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L27)

***

### expiresAt?

> `readonly` `optional` **expiresAt?**: `string`

Defined in: [packages/core/src/credentials.ts:30](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L30)

ISO-8601 expiry time for the access token

***

### kind

> `readonly` **kind**: `"token"`

Defined in: [packages/core/src/credentials.ts:26](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L26)

***

### refreshExpiresAt?

> `readonly` `optional` **refreshExpiresAt?**: `string`

Defined in: [packages/core/src/credentials.ts:32](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L32)

ISO-8601 expiry time for the refresh token

***

### refreshToken?

> `readonly` `optional` **refreshToken?**: `string`

Defined in: [packages/core/src/credentials.ts:28](https://github.com/sgoley/maitredb/blob/39735963a13b9d7a55753aff783ac89c8bc8c091/packages/core/src/credentials.ts#L28)
