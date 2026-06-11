# `@khoralabs/duplex-byte-stream`

Minimal `DuplexByteStream` interface and channel admission tickets for OBP transports and the frame relay hub.

## Exports

### `DuplexByteStream`

Interface for a bidirectional byte channel:

```ts
interface DuplexByteStream {
  send(bytes: Uint8Array): void;
  onMessage(handler: (bytes: Uint8Array) => void): void;
  close(): void;
}
```

### `createMemoryDuplexByteStreamPair`

Creates a linked in-memory pair for tests — bytes sent on one side are received on the other.

### Bounded inbound queues

Each read side buffers at most `DEFAULT_MAX_INBOUND_QUEUE_DEPTH` (256) chunks. When a fast sender exceeds that depth, the stream **closes** and drops the overflow chunk — preventing memory DoS on WebSocket and in-memory adapters. Override via `maxInboundQueueDepth` on `createMemoryDuplexByteStreamPair` / `createWebSocketDuplexByteStream`.

### WebSocket adapter

`createWebSocketDuplexByteStream` / `WebSocketDuplexByteSend` — wraps a WebSocket into a `DuplexByteStream`.

### Channel admission tickets

HMAC-SHA256 join proofs scoped to a channel ID. Used by `@khoralabs/obp-frame-relay` to admit peers.

```ts
import {
  generateChannelSecretHex,
  signChannelTicket,
  verifyChannelTicket,
} from "@khoralabs/duplex-byte-stream";

const secret = generateChannelSecretHex();
const ticket = await signChannelTicket(channelId, secret, {
  expiresAtMs: Date.now() + 86_400_000,
});
const valid = await verifyChannelTicket(channelId, ticket, secret); // true
```

Wire format: `base64url(v1:{"cid","exp",...}).base64url(sig)`.

## Scripts

- `bun test` — channel ticket round-trip tests
- `bun run typecheck` — `tsc --noEmit`
