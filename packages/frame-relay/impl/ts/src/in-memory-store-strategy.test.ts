import { describe, expect, test } from "bun:test";
import { InMemoryFrameRelayStoreStrategy } from "./in-memory-store-strategy";

describe("InMemoryFrameRelayStoreStrategy spool limits", () => {
  test("enqueue stays within maxFramesPerChannel", () => {
    const store = new InMemoryFrameRelayStoreStrategy({
      spoolLimits: {
        maxFramesPerChannel: 3,
        maxBytesPerChannel: 1024,
        maxReplayFrames: 1024,
        maxReplayBytes: 1024 * 1024,
      },
    });
    for (let i = 0; i < 5; i++) {
      store.enqueueRelayedFrame("ch", new Uint8Array([i]));
    }
    expect(store.listRelayedFramesAfter("ch", 0)).toHaveLength(3);
    expect(store.listRelayedFramesAfter("ch", 0)[0]?.id).toBe(3);
  });

  test("enqueue stays within maxBytesPerChannel", () => {
    const store = new InMemoryFrameRelayStoreStrategy({
      spoolLimits: {
        maxFramesPerChannel: 100,
        maxBytesPerChannel: 25,
        maxReplayFrames: 1024,
        maxReplayBytes: 1024 * 1024,
      },
    });
    store.enqueueRelayedFrame("ch", new Uint8Array(10));
    store.enqueueRelayedFrame("ch", new Uint8Array(10));
    store.enqueueRelayedFrame("ch", new Uint8Array(10));
    expect(store.listRelayedFramesAfter("ch", 0)).toHaveLength(2);
  });

  test("purgeExpiredChannels removes expired admission and frames", () => {
    const store = new InMemoryFrameRelayStoreStrategy();
    const now = 1_000_000;
    store.upsertChannelAdmission({
      channelId: "expired",
      pairingSecretHex: "aa",
      createdAtMs: now - 10_000,
      expiresAtMs: now - 1,
    });
    store.upsertChannelAdmission({
      channelId: "active",
      pairingSecretHex: "bb",
      createdAtMs: now,
      expiresAtMs: now + 60_000,
    });
    store.enqueueRelayedFrame("expired", new Uint8Array([1]));
    store.enqueueRelayedFrame("active", new Uint8Array([2]));

    expect(store.purgeExpiredChannels(now)).toBe(1);
    expect(store.getPairingSecretIfActive("expired", now)).toBeUndefined();
    expect(store.listRelayedFramesAfter("expired", 0)).toHaveLength(0);
    expect(store.getPairingSecretIfActive("active", now)).toBe("bb");
    expect(store.listRelayedFramesAfter("active", 0)).toHaveLength(1);
  });
});
