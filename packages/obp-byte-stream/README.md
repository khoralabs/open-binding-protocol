# `@khoralabs/obp-byte-stream`

Minimal `DuplexByteStream` interface for OBP frame transports.

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

Channel admission tickets and relay persistence live in the **relay** repo (`@khoralabs/relay-admission`, `@khoralabs/relay-server-http`).

## Scripts

- `bun test`
- `bun run typecheck` — `tsc --noEmit`
