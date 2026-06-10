# `@khoralabs/obp-sqlite-persistence`

SQLite reference implementation of `ObpPersistenceStrategy` for the `khora.obp` persistence surface.

## Usage

```ts
import { openObpDatabase, SqliteObpPersistenceStrategy } from "@khoralabs/obp-sqlite-persistence";
import { ObpPersistenceClient } from "@khoralabs/obp-persistence";

const db = openObpDatabase("obp.db");
const strategy = new SqliteObpPersistenceStrategy(db);
const client = new ObpPersistenceClient(strategy);
```

`openObpDatabase` opens (or creates) a SQLite file, enables `PRAGMA foreign_keys` and `PRAGMA journal_mode = WAL`, and runs the frozen DDL (`OBP_SCHEMA_SQL`). Safe to call on every open.

## Schema

The schema (`OBP_SCHEMA_SQL`) is frozen DDL — tables for parties, offers, ports, expose paths, bind rows, and NBC metadata columns (`nbc_expires_*`, bind policy). Import `initObpSchema` if you manage your own `Database` instance.

## Scripts

- `bun test` — strategy round-trip tests
- `bun run typecheck` — `tsc --noEmit`
