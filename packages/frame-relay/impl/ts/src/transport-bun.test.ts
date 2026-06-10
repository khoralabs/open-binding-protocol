import { describe, expect, test } from "bun:test";

import { createFrameRelayHub } from "./hub";
import { InMemoryFrameRelayStoreStrategy } from "./in-memory-store-strategy";
import {
  frameRelayHubWebSocketHandlers,
  isAllowedWebSocketOrigin,
  isSecureWebSocketUpgrade,
  upgradeFrameRelayHubWebSocket,
  webSocketRequestOrigin,
} from "./transport-bun";

describe("isAllowedWebSocketOrigin", () => {
  test("allows listed origin", () => {
    expect(isAllowedWebSocketOrigin("https://app.example.com", ["https://app.example.com"])).toBe(
      true,
    );
  });

  test("rejects unknown origin", () => {
    expect(isAllowedWebSocketOrigin("https://evil.example.com", ["https://app.example.com"])).toBe(
      false,
    );
  });

  test("allows missing origin by default", () => {
    expect(isAllowedWebSocketOrigin(null, ["https://app.example.com"])).toBe(true);
  });

  test("rejects missing origin when configured", () => {
    expect(
      isAllowedWebSocketOrigin(null, ["https://app.example.com"], { rejectMissingOrigin: true }),
    ).toBe(false);
  });
});

describe("isSecureWebSocketUpgrade", () => {
  test("accepts https URL", () => {
    expect(isSecureWebSocketUpgrade(new Request("https://relay.example/ws"))).toBe(true);
  });

  test("accepts x-forwarded-proto https", () => {
    expect(
      isSecureWebSocketUpgrade(
        new Request("http://relay.example/ws", { headers: { "x-forwarded-proto": "https" } }),
      ),
    ).toBe(true);
  });

  test("rejects plain http without forwarded proto", () => {
    expect(isSecureWebSocketUpgrade(new Request("http://relay.example/ws"))).toBe(false);
  });
});

describe("upgradeFrameRelayHubWebSocket", () => {
  test("rejects disallowed Origin", async () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    const { ticket } = await hub.createChannel("room-a");

    const res = await upgradeFrameRelayHubWebSocket({
      req: new Request("https://relay.example/ws", {
        headers: { upgrade: "websocket", origin: "https://evil.example.com" },
      }),
      channelId: "room-a",
      ticket,
      hub,
      allowedOrigins: ["https://app.example.com"],
      upgrade: () => true,
    });

    expect(res?.status).toBe(403);
  });

  test("authorize hook can reject upgrade", async () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    const { ticket } = await hub.createChannel("room-a");

    const res = await upgradeFrameRelayHubWebSocket({
      req: new Request("https://relay.example/ws", { headers: { upgrade: "websocket" } }),
      channelId: "room-a",
      ticket,
      hub,
      authorize: () => false,
      upgrade: () => true,
    });

    expect(res?.status).toBe(403);
  });

  test("requireTls rejects insecure upgrade", async () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    const { ticket } = await hub.createChannel("room-a");

    const res = await upgradeFrameRelayHubWebSocket({
      req: new Request("http://relay.example/ws", { headers: { upgrade: "websocket" } }),
      channelId: "room-a",
      ticket,
      hub,
      requireTls: true,
      upgrade: () => true,
    });

    expect(res?.status).toBe(403);
  });

  test("webSocketRequestOrigin reads header", () => {
    const req = new Request("https://relay.example/ws", {
      headers: { origin: "https://app.example.com" },
    });
    expect(webSocketRequestOrigin(req)).toBe("https://app.example.com");
  });
});

describe("frameRelayHubWebSocketHandlers onOpen", () => {
  test("exports handler factory with optional onOpen", () => {
    const hub = createFrameRelayHub({ store: new InMemoryFrameRelayStoreStrategy() });
    const handlers = frameRelayHubWebSocketHandlers({
      hub,
      onOpen: async () => true,
    });
    expect(typeof handlers.open).toBe("function");
  });
});
