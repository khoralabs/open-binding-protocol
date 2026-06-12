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

Adapts a WebSocket connection into a `DuplexByteStream` for use with the OBP frame session pipeline (`@khoralabs/obp-frames-impl`). OBP `Frame.body` is logical plaintext. Internet hub deployments should wrap the byte stream with `khora.obp.frame.mls` (RFC 9420 MLS); see `packages/frames/impl/ts/docs/TRANSPORT_CONFIDENTIALITY.md`.
