# @maitredb/driver-template

Reusable scaffold for building Maître d'B database drivers.

## How to use this template

1. **Copy the package** — duplicate this folder into `packages/driver-<dialect>/` and adjust
   `package.json`, dependency list, and metadata.
2. **Search for `TODO(driver)`** — every required method and helper in `src/index.ts` contains a
   dialect-specific instruction so contributors know exactly what to implement.
3. **Update the `NativeClient` alias** — point it to whichever object your underlying driver returns
   (a client, pool, SDK, etc.) so callers receive helpful typings.
4. **Fill out the lifecycle + streaming methods first** — spec sections
   [`Driver Adapter Interface`](../../spec/architecture.md#driver-adapter-interface) and
   [`Streaming-First Architecture`](../../spec/architecture.md#streaming-first-architecture) define
   the baseline experience for every driver.
5. **Complete the `DRIVER_BOOTSTRAP_CHECKLIST`** — the exported checklist mirrors the architecture
   requirements; ticking each item ensures feature parity across dialects.
6. **Document any dialect quirks** — prefer inline comments that explain non-obvious catalog queries
   or auth flows so future contributors can maintain the driver confidently.

The template intentionally compiles but throws for every method so it never ships by accident. Copy
it, implement the TODOs, and delete anything that is not relevant for the target database.

## References

- [`spec/architecture.md`](../../spec/architecture.md)
- [`spec/implementation-plan.md`](../../spec/implementation-plan.md)
- `@maitredb/driver-sqlite` for a minimal working implementation
