import type { Database } from "bun:sqlite";
import { ObpPersistenceClient } from "@khoralabs/obp-persistence";
import { createObpSqliteStrategy, SqliteObpPersistenceStrategy } from "./strategy";

export { initObpSchema, openObpDatabase } from "./connection";
export { OBP_SCHEMA_SQL } from "./schema";
export { createObpSqliteStrategy, SqliteObpPersistenceStrategy };

export function createObpSqlitePersistenceClient(db: Database): ObpPersistenceClient {
  return new ObpPersistenceClient(createObpSqliteStrategy(db));
}
