# `@khoralabs/obp-sqlite-persistence`

SQLite reference implementation of `ObpPersistenceStrategy` for the `khora.obp` persistence surface.

## Usage

```ts
import { openObpV2Database, SqliteObpPersistenceStrategy } from "@khoralabs/obp-sqlite-persistence";
import { ObpPersistenceClient } from "@khoralabs/obp-persistence";

const db = openObpV2Database("obp.db");
const strategy = new SqliteObpPersistenceStrategy(db);
const client = new ObpPersistenceClient(strategy);
```

`openObpV2Database` opens (or creates) a SQLite file, enables `PRAGMA foreign_keys` and `PRAGMA journal_mode = WAL`, and runs the frozen DDL (`OBP_V2_SCHEMA_SQL`). Safe to call on every open.

## Schema

The schema (`OBP_V2_SCHEMA_SQL`) is frozen DDL — tables for parties, offers, ports, expose paths, bind rows, and NBC metadata columns (`nbc_expires_*`, bind policy). Import `initObpV2Schema` if you manage your own `Database` instance.

## Scripts

- `bun test` — strategy round-trip tests
- `bun run typecheck` — `tsc --noEmit`
