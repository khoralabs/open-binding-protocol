import { describe, expect, test } from "bun:test";
import { createMemoryDuplexByteStreamPair } from "@khoralabs/duplex-byte-stream";
import { encodeFramedJson } from "@khoralabs/obp-frames-impl";
import { attachDuplexAsFrameRelayPeer } from "./duplex-peer";
import { createFrameRelayHub } from "./hub";
import type { FrameRelayHubPort } from "./hub-port";
import { InMemoryFrameRelayStoreStrategy } from "./in-memory-store-strategy";
import { upgradeFrameRelayHubWebSocket } from "./transport-bun";

async function channelTicket(hub: FrameRelayHubPort, channelId: string): Promise<string> {
  const { ticket } = await hub.createChannel(channelId);
  return ticket;
}

describe("createFrameRelayHub", () => {
  test("createChannel clears prior frames", async () => {
    const store = new InMemoryFrameRelayStoreStrategy();
    const hub = createFrameRelayHub({ store });
    store.enqueueRelayedFrame("room-a", new Uint8Array([1]));
    await hub.createChannel("room-a");
    expect(store.listRelayedFramesAfter("room-a", 0)).toHaveLength(0);
  });

  test("attachPeer rejects invalid ticket", async () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    await hub.createChannel("room-a");

    await expect(hub.attachPeer("room-a", { send() {} }, "not-a-valid-ticket")).rejects.toThrow(
      "invalid or expired ticket",
    );
  });

  test("relayBytes echoes wrapped frame to every peer including sender", async () => {
    const store = new InMemoryFrameRelayStoreStrategy();
    const hub = createFrameRelayHub({ store });
    const ticket = await channelTicket(hub, "room-a");

    const received: Uint8Array[] = [];
    const p1 = {
      send(b: Uint8Array) {
        received.push(b);
      },
    };
    const p2 = {
      send(b: Uint8Array) {
        received.push(b);
      },
    };
    await hub.attachPeer("room-a", p1, ticket);
    await hub.attachPeer("room-a", p2, ticket);

    const frame = {
      p_hash: "a".repeat(64),
      actor: "00",
      sig: "s",
      type: "TURN",
      body: {},
    };
    const raw = encodeFramedJson(frame);
    hub.relayBytes("room-a", p1, raw);

    expect(received.length).toBe(2);
    for (const b of received) {
      const len = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(0, false);
      expect(4 + len).toBe(b.length);
      const json = JSON.parse(new TextDecoder().decode(b.subarray(4, 4 + len))) as {
        frame: unknown;
        relay_ts_ms: number;
      };
      expect(json.relay_ts_ms).toEqual(expect.any(Number));
      expect((json.frame as { type: string }).type).toBe("TURN");
    }
  });

  test("relayBytes rejects pre-wrapped relay envelopes with forged relay_ts_ms", async () => {
    const store = new InMemoryFrameRelayStoreStrategy();
    const hub = createFrameRelayHub({ store });
    const ticket = await channelTicket(hub, "room-a");

    const received: Uint8Array[] = [];
    const p1 = {
      send(b: Uint8Array) {
        received.push(b);
      },
    };
    const p2 = {
      send(b: Uint8Array) {
        received.push(b);
      },
    };
    await hub.attachPeer("room-a", p1, ticket);
    await hub.attachPeer("room-a", p2, ticket);

    const frame = {
      p_hash: "a".repeat(64),
      actor: "00",
      sig: "s",
      type: "TURN",
      body: {},
    };
    const forged = encodeFramedJson({
      frame,
      relay_ts_ms: 1,
    });
    hub.relayBytes("room-a", p1, forged);

    expect(received).toHaveLength(0);
    expect(store.listRelayedFramesAfter("room-a", 0)).toHaveLength(0);
  });

  test("relayBytes wraps TURN with E2EE ciphertext body", async () => {
    const store = new InMemoryFrameRelayStoreStrategy();
    const hub = createFrameRelayHub({ store });
    const ticket = await channelTicket(hub, "room-a");

    const received: Uint8Array[] = [];
    const p1 = {
      send(b: Uint8Array) {
        received.push(b);
      },
    };
    await hub.attachPeer("room-a", p1, ticket);

    const frame = {
      p_hash: "a".repeat(64),
      actor: "00",
      sig: "s",
      type: "TURN",
      body: {
        e2ee: { v: 1, alg: "A256GCM", iv: "AAAA", ct: "BBBB" },
      },
    };
    const raw = encodeFramedJson(frame);
    hub.relayBytes("room-a", p1, raw);

    expect(received.length).toBe(1);
    const json = JSON.parse(
      new TextDecoder().decode(received[0]?.subarray(4, 4 + (received[0]?.length ?? 0) - 4)),
    ) as { frame: { body: { e2ee: { ct: string } } } };
    expect(json.frame.body.e2ee.ct).toBe("BBBB");
  });
});

describe("upgradeFrameRelayHubWebSocket", () => {
  test("rejects missing ticket", async () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    await hub.createChannel("room-a");

    const res = await upgradeFrameRelayHubWebSocket({
      req: new Request("http://localhost/ws", { headers: { upgrade: "websocket" } }),
      channelId: "room-a",
      ticket: "",
      hub,
      upgrade: () => true,
    });

    expect(res?.status).toBe(400);
  });

  test("rejects invalid ticket", async () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    await hub.createChannel("room-a");

    const res = await upgradeFrameRelayHubWebSocket({
      req: new Request("http://localhost/ws", { headers: { upgrade: "websocket" } }),
      channelId: "room-a",
      ticket: "bad.ticket",
      hub,
      upgrade: () => true,
    });

    expect(res?.status).toBe(401);
  });

  test("upgrades with valid ticket", async () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    const { ticket } = await hub.createChannel("room-a");
    let upgradedData: { sessionId: string; ticket: string } | undefined;

    const res = await upgradeFrameRelayHubWebSocket({
      req: new Request("http://localhost/ws", { headers: { upgrade: "websocket" } }),
      channelId: "room-a",
      ticket,
      hub,
      upgrade(_req, data) {
        upgradedData = { sessionId: data.sessionId, ticket: data.ticket };
        return true;
      },
    });

    expect(res).toBeUndefined();
    expect(upgradedData).toEqual({ sessionId: "room-a", ticket });
  });
});

describe("attachDuplexAsFrameRelayPeer", () => {
  test("inbound duplex bytes are relayed to other peers", async () => {
    const store = new InMemoryFrameRelayStoreStrategy();
    const hub = createFrameRelayHub({ store });
    const ticket = await channelTicket(hub, "room-a");

    const [clientSide, serverSide] = createMemoryDuplexByteStreamPair();
    await attachDuplexAsFrameRelayPeer(hub, "room-a", ticket, serverSide);

    const received: Uint8Array[] = [];
    await hub.attachPeer(
      "room-a",
      {
        send(b) {
          received.push(b);
        },
      },
      ticket,
    );

    const frame = {
      p_hash: "a".repeat(64),
      actor: "00",
      sig: "s",
      type: "TURN",
      body: {},
    };
    const raw = encodeFramedJson(frame);
    await clientSide.write(raw);

    for (let i = 0; i < 50 && received.length === 0; i++) {
      await new Promise<void>((r) => queueMicrotask(r));
    }

    expect(received.length).toBeGreaterThanOrEqual(1);
    await clientSide.close();
  });

  test("dispose closes duplex", async () => {
    const store = new InMemoryFrameRelayStoreStrategy();
    const hub = createFrameRelayHub({ store });
    const ticket = await channelTicket(hub, "room-x");

    const [clientSide, serverSide] = createMemoryDuplexByteStreamPair();
    const { dispose } = await attachDuplexAsFrameRelayPeer(hub, "room-x", ticket, serverSide);
    await dispose();
    await clientSide.close();
  });
});
