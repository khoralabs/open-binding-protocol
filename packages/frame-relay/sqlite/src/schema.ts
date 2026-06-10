import type { Database } from "bun:sqlite";

/** Reference SQLite schema for {@link FrameRelayStoreStrategy}. */
export function ensureFrameRelayStoreSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      channel_id TEXT PRIMARY KEY NOT NULL,
      -- AES-256-GCM envelope (see pairing-secret-cipher.ts); legacy rows may be plaintext hex.
      pairing_secret_hex TEXT NOT NULL,
      created_at_ms INTEGER NOT NULL,
      expires_at_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS room_frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      bytes BLOB NOT NULL,
      byte_length INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_room_frames_channel_id ON room_frames(channel_id);
  `);
  ensureByteLengthColumn(db);
}

function ensureByteLengthColumn(db: Database): void {
  const cols = db.prepare(`PRAGMA table_info(room_frames)`).all() as { name: string }[];
  if (cols.some((c) => c.name === "byte_length")) {
    return;
  }
  db.run(`ALTER TABLE room_frames ADD COLUMN byte_length INTEGER NOT NULL DEFAULT 0`);
  db.run(`UPDATE room_frames SET byte_length = length(bytes) WHERE byte_length = 0`);
}
