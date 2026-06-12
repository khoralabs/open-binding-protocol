# OBP HTTP/2 transport

HTTP/2 reference transport binding for OBP frame sessions.

## Layout

| Path | Package |
|------|---------|
| `spec/model/` | `@khoralabs/obp-transport-http2-spec` — Smithy binding spec (`khora.obp.frame.http2`) |
| `impl/ts/` | `@khoralabs/obp-transport-http2` — HTTP/2 channel and connection helpers wrapping `@khoralabs/duplex-byte-stream` |

## Usage

```bash
cd packages/transport-http2/impl/ts && bun run typecheck
cd packages/transport-http2/spec && smithy validate model && smithy build
```

Adapts an HTTP/2 stream into a `DuplexByteStream` for use with the OBP frame session pipeline (`@khoralabs/obp-frames-impl`). Confidentiality is TLS (or local trust); OBP `Frame.body` is logical plaintext. For internet relay deployments use the MLS hub profile (`khora.obp.frame.mls`) — see `packages/frames/impl/ts/docs/TRANSPORT_CONFIDENTIALITY.md`.
