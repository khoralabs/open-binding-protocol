import type { Database } from "bun:sqlite";
import type {
  ChannelAdmissionRecord,
  FrameRelayStoreStrategy,
  RelayedFrameRecord,
} from "@khoralabs/obp-frame-relay";
import {
  DEFAULT_FRAME_RELAY_SPOOL_LIMITS,
  type FrameRelaySpoolLimits,
} from "@khoralabs/obp-frame-relay";
import { decryptPairingSecretHex, encryptPairingSecretHex } from "./pairing-secret-cipher";
import { ensureFrameRelayStoreSchema } from "./schema";

export type SqliteFrameRelayStoreOptions = {
  spoolLimits?: FrameRelaySpoolLimits;
  /** 32-byte AES key from KMS/env; pairing secrets are encrypted at rest before INSERT. */
  pairingSecretKey: Uint8Array;
};

function trimChannelSpool(
  db: Database,
  channelId: string,
  limits: Pick<FrameRelaySpoolLimits, "maxFramesPerChannel" | "maxBytesPerChannel">,
): void {
  const countRow = db
    .prepare(`SELECT COUNT(*) AS c FROM room_frames WHERE channel_id = ?`)
    .get(channelId) as { c: number };
  const excessFrames = countRow.c - limits.maxFramesPerChannel;
  if (excessFrames > 0) {
    db.prepare(
      `DELETE FROM room_frames WHERE channel_id = ? AND id IN (
         SELECT id FROM room_frames WHERE channel_id = ? ORDER BY id ASC LIMIT ?
       )`,
    ).run(channelId, channelId, excessFrames);
  }

  for (;;) {
    const sumRow = db
      .prepare(
        `SELECT COALESCE(SUM(byte_length), 0) AS total FROM room_frames WHERE channel_id = ?`,
      )
      .get(channelId) as { total: number };
    if (sumRow.total <= limits.maxBytesPerChannel) {
      break;
    }
    const deleted = db
      .prepare(
        `DELETE FROM room_frames WHERE channel_id = ? AND id = (
           SELECT id FROM room_frames WHERE channel_id = ? ORDER BY id ASC LIMIT 1
         )`,
      )
      .run(channelId, channelId);
    if (deleted.changes === 0) {
      break;
    }
  }
}

export function createSqliteFrameRelayStoreStrategy(
  db: Database,
  options?: SqliteFrameRelayStoreOptions,
): FrameRelayStoreStrategy {
  const spoolLimits = options?.spoolLimits ?? DEFAULT_FRAME_RELAY_SPOOL_LIMITS;
  const pairingSecretKey = options?.pairingSecretKey;
  if (pairingSecretKey === undefined) {
    throw new Error("pairingSecretKey is required for SQLite frame relay store");
  }
  ensureFrameRelayStoreSchema(db);
  const upsertAdmissionStmt = db.prepare(
    `INSERT INTO rooms (channel_id, pairing_secret_hex, created_at_ms, expires_at_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(channel_id) DO UPDATE SET
       pairing_secret_hex = excluded.pairing_secret_hex,
       created_at_ms = excluded.created_at_ms,
       expires_at_ms = excluded.expires_at_ms`,
  );
  const selectAdmission = db.query(
    `SELECT pairing_secret_hex, created_at_ms, expires_at_ms
     FROM rooms WHERE channel_id = ? AND expires_at_ms > ?`,
  );
  const enqueueFrameStmt = db.query(
    `INSERT INTO room_frames (channel_id, bytes, byte_length) VALUES (?, ?, ?) RETURNING id`,
  );
  const selectFramesAfter = db.query(
    `SELECT id, bytes FROM room_frames WHERE channel_id = ? AND id > ? ORDER BY id ASC`,
  );
  const purgeFramesStmt = db.prepare(`DELETE FROM room_frames WHERE channel_id = ?`);
  const deleteAdmissionStmt = db.prepare(`DELETE FROM rooms WHERE channel_id = ?`);

  return {
    upsertChannelAdmission(record: ChannelAdmissionRecord): void {
      upsertAdmissionStmt.run(
        record.channelId,
        encryptPairingSecretHex(record.pairingSecretHex, pairingSecretKey),
        record.createdAtMs,
        record.expiresAtMs,
      );
    },

    getChannelAdmissionIfActive(
      channelId: string,
      nowMs: number,
    ): ChannelAdmissionRecord | undefined {
      const row = selectAdmission.get(channelId, nowMs) as
        | { pairing_secret_hex: string; created_at_ms: number; expires_at_ms: number }
        | null
        | undefined;
      if (row == null) {
        return undefined;
      }
      return {
        channelId,
        pairingSecretHex: decryptPairingSecretHex(row.pairing_secret_hex, pairingSecretKey),
        createdAtMs: row.created_at_ms,
        expiresAtMs: row.expires_at_ms,
      };
    },

    getPairingSecretIfActive(channelId: string, nowMs: number): string | undefined {
      return this.getChannelAdmissionIfActive(channelId, nowMs)?.pairingSecretHex;
    },

    enqueueRelayedFrame(channelId: string, bytes: Uint8Array): number {
      const row = enqueueFrameStmt.get(channelId, bytes, bytes.byteLength) as { id: number };
      trimChannelSpool(db, channelId, spoolLimits);
      return row.id;
    },

    listRelayedFramesAfter(channelId: string, afterId: number): RelayedFrameRecord[] {
      const rows = selectFramesAfter.all(channelId, afterId) as Array<{
        id: number;
        bytes: Uint8Array;
      }>;
      return rows.map((r) => ({ id: r.id, bytes: r.bytes }));
    },

    purgeRelayedFramesForChannel(channelId: string): void {
      purgeFramesStmt.run(channelId);
    },

    deleteChannelAdmission(channelId: string): void {
      deleteAdmissionStmt.run(channelId);
    },

    purgeExpiredChannels(nowMs: number): number {
      const expired = db
        .prepare(`SELECT channel_id FROM rooms WHERE expires_at_ms <= ?`)
        .all(nowMs) as { channel_id: string }[];
      if (expired.length === 0) {
        return 0;
      }
      db.prepare(`DELETE FROM room_frames WHERE channel_id IN (
        SELECT channel_id FROM rooms WHERE expires_at_ms <= ?
      )`).run(nowMs);
      const result = db.prepare(`DELETE FROM rooms WHERE expires_at_ms <= ?`).run(nowMs);
      return result.changes;
    },
  };
}
