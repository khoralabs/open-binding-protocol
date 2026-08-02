import { Database } from "bun:sqlite";
import { OBP_SCHEMA_SQL } from "./schema";

/** Run frozen DDL (safe to call on every open). */
export function initObpSchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");
  db.run("PRAGMA journal_mode = WAL;");
  db.run(OBP_SCHEMA_SQL);
  migrateObpSchema(db);
}

function migrateObpSchema(db: Database): void {
  const offerCols = db
    .query<{ name: string }, []>("PRAGMA table_info(obp_offers)")
    .all()
    .map((r) => r.name);
  if (!offerCols.includes("nbc_expires_at_ms")) {
    db.run("ALTER TABLE obp_offers ADD COLUMN nbc_expires_at_ms INTEGER NOT NULL DEFAULT 0");
  }
  const portCols = db
    .query<{ name: string }, []>("PRAGMA table_info(obp_ports)")
    .all()
    .map((r) => r.name);
  if (!portCols.includes("nbc_expires_at_ms")) {
    db.run("ALTER TABLE obp_ports ADD COLUMN nbc_expires_at_ms INTEGER NOT NULL DEFAULT 0");
  }
  if (offerCols.includes("nbc_expires_at_relay_ms")) {
    db.run("ALTER TABLE obp_offers DROP COLUMN nbc_expires_at_relay_ms");
  }
  if (portCols.includes("nbc_expires_at_relay_ms")) {
    db.run("ALTER TABLE obp_ports DROP COLUMN nbc_expires_at_relay_ms");
  }
}

/** Open (or create) a SQLite file and initialize OBP tables. */
export function openObpDatabase(filename: string): Database {
  const db = new Database(filename, { create: true });
  initObpSchema(db);
  return db;
}
