# OBP WebSocket transport

WebSocket transport binding for OBP frame sessions.

## Layout

| Path | Package |
|------|---------|
| `impl/ts/` | `@khoralabs/obp-transport-ws` — WebSocket channel and connection helpers wrapping `@khoralabs/duplex-byte-stream` |

## Usage

```bash
cd packages/transport-ws/impl/ts && bun run typecheck
```

Adapts a WebSocket connection into a `DuplexByteStream` for use with the OBP frame session pipeline (`@khoralabs/obp-frames-impl`).
