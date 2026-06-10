import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { isEncryptedPairingSecret } from "./pairing-secret-cipher";
import { pairingSecretKeyFromHex, TEST_PAIRING_SECRET_KEY_HEX } from "./pairing-secret-key";
import { createSqliteFrameRelayStoreStrategy } from "./strategy";

const testKey = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);

function testStore(db: Database) {
  return createSqliteFrameRelayStoreStrategy(db, { pairingSecretKey: testKey });
}

describe("createSqliteFrameRelayStoreStrategy", () => {
  test("persists admission and relayed frames", () => {
    const db = new Database(":memory:");
    const store = testStore(db);
    const now = Date.now();
    store.upsertChannelAdmission({
      channelId: "ch-1",
      pairingSecretHex: "abc",
      createdAtMs: now,
      expiresAtMs: now + 60_000,
    });
    expect(store.getPairingSecretIfActive("ch-1", now)).toBe("abc");
    const row = db
      .prepare(`SELECT pairing_secret_hex FROM rooms WHERE channel_id = ?`)
      .get("ch-1") as { pairing_secret_hex: string };
    expect(isEncryptedPairingSecret(row.pairing_secret_hex)).toBe(true);
    const id = store.enqueueRelayedFrame("ch-1", new Uint8Array([1, 2, 3]));
    expect(id).toBe(1);
    expect(store.listRelayedFramesAfter("ch-1", 0)).toHaveLength(1);
    store.purgeRelayedFramesForChannel("ch-1");
    expect(store.listRelayedFramesAfter("ch-1", 0)).toHaveLength(0);
    store.deleteChannelAdmission("ch-1");
    expect(store.getPairingSecretIfActive("ch-1", now)).toBeUndefined();
  });

  test("enqueue stays within maxFramesPerChannel", () => {
    const db = new Database(":memory:");
    const store = createSqliteFrameRelayStoreStrategy(db, {
      pairingSecretKey: testKey,
      spoolLimits: {
        maxFramesPerChannel: 2,
        maxBytesPerChannel: 1024 * 1024,
        maxReplayFrames: 1024,
        maxReplayBytes: 1024 * 1024,
      },
    });
    store.enqueueRelayedFrame("ch", new Uint8Array([1]));
    store.enqueueRelayedFrame("ch", new Uint8Array([2]));
    store.enqueueRelayedFrame("ch", new Uint8Array([3]));
    const rows = store.listRelayedFramesAfter("ch", 0);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.bytes[0]).toBe(2);
    expect(rows[1]?.bytes[0]).toBe(3);
  });

  test("purgeExpiredChannels removes expired admission and frames", () => {
    const db = new Database(":memory:");
    const store = testStore(db);
    const now = 1_000_000;
    store.upsertChannelAdmission({
      channelId: "expired",
      pairingSecretHex: "aa",
      createdAtMs: now - 10_000,
      expiresAtMs: now - 1,
    });
    store.enqueueRelayedFrame("expired", new Uint8Array([9]));

    expect(store.purgeExpiredChannels(now)).toBe(1);
    expect(store.getPairingSecretIfActive("expired", now)).toBeUndefined();
    expect(store.listRelayedFramesAfter("expired", 0)).toHaveLength(0);
  });
});
