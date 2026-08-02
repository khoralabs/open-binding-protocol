import type { Database } from "bun:sqlite";
import type { ValidateBindPolicyAtExpose } from "@khoralabs/obp-core/persistence";
import { ObpPersistenceClient } from "@khoralabs/obp-core/persistence";
import { createObpSqliteStrategy, SqliteObpPersistenceStrategy } from "./strategy";

export { initObpSchema, openObpDatabase } from "./connection";
export { OBP_SCHEMA_SQL } from "./schema";
export { createObpSqliteStrategy, SqliteObpPersistenceStrategy };

export function createObpSqlitePersistenceClient(
  db: Database,
  options?: { validateBindPolicyAtExpose?: ValidateBindPolicyAtExpose },
): ObpPersistenceClient {
  return new ObpPersistenceClient(createObpSqliteStrategy(db, options));
}
