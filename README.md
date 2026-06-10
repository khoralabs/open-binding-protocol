# OBP — Open Binding Protocol

OBP is a **wiring calculus for agent affordances**. A Party publishes Offers; each Offer exposes Ports it provides and binds Ports it requires. When a peer binds a port, they make a verifiable commitment to an affordance the counterparty exposed.

```
Party ──EXTENDS──▶ Offer ──EXPOSES──▶ Port
                  Offer ──BINDS──▶   Port
```

An Offer is best read as a module with imports and exports:
`Offer : BoundPorts → ExposedPorts`

With NBC (Negotiated Binding Convention), a bilateral negotiation is a co-authored signed Frame DAG — each TURN is chained by `p_hash` and signed by its sender, so neither party can unilaterally tamper with or reorder the shared transcript. Accepted TURN effects are projected into the OBP persistence graph.

OBP itself is not policy, authorization, expiry, or execution — it is the structural substrate those layers operate on.

## Three layers

- **Graph** (`khora.obp`) — the typed DAG: parties, offers, ports, and bind edges. Thin shapes; NBC bind-window timing and capacity live in the NBC layer, not on the core shapes.
- **Convention** (`khora.obp.nbc`) — NBC: when a bind is admissible. Expiry windows, `max_bindings` capacity, bind-payload validation (N4), concurrent bind atomicity, and revocation (N1–N9).
- **Transport** (`khora.obp.frame`, `khora.obp.session`) — the co-authored Frame DAG and session Merkle log. Each `SessionEnvelope` carries `Checkpoint.root_hex` over all prior operations; tampered or dropped frames produce a detectable root mismatch.

A stack may be OBP-conformant without NBC. NBC is a named additive conformance layer.

## Packages

| Package | Description |
|---------|-------------|
| `@khoralabs/obp-model` | `khora.obp` graph vocabulary: `Party`, `Offer`, `Port`, edges |
| `@khoralabs/obp-persistence` | `ObpPersistenceStrategy` adapter interface + `ObpPersistenceClient` |
| `@khoralabs/obp-sqlite-persistence` | SQLite reference persistence strategy |
| `@khoralabs/obp-nbc` | NBC bind-time checks (N1–N6), `applyNbcTurn`, session helpers |
| `@khoralabs/nbc-bind-policy` | JSON Schema (draft 2020-12) + AJV validation for NBC bind payloads |
| `@khoralabs/obp-frames-impl` | `khora.obp.frame` wire types, canonical JSON, signing, length-prefix framing |
| `@khoralabs/obp-session-impl` | Session Merkle checkpoints, `SessionEnvelope` verification |
| `@khoralabs/obp-transport-http2` | HTTP/2 reference transport binding |
| `@khoralabs/obp-transport-ws` | WebSocket transport binding |
| `@khoralabs/obp-frame-relay` | Ticket-gated hub relay for OBP byte streams |
| `@khoralabs/obp-frame-relay-sqlite` | SQLite strategy for `FrameRelayStoreStrategy` |
| `@khoralabs/duplex-byte-stream` | `DuplexByteStream` interface, channel admission tickets (HMAC) |
| `@khoralabs/obp-react` | React NBC chain visualization (XYFlow) |
| `@khoralabs/obp-errors` | Shared `ObpError` / `ObpErrorCode` |

See [`packages/README.md`](packages/README.md) for protocol layering, Smithy namespaces, and spec dependency graph.

## Setup

```bash
bun install
```

## Development

```bash
bun run format          # format (Biome)
bun run format:check    # lint/format check
bun run typecheck       # tsc across all packages
bun test                # all tests
```

Husky wires `format:check` on pre-commit and `format:check + typecheck + test` on pre-push.

## Smithy specs

Each `packages/*/spec` directory contains a Smithy model. To validate all specs in dependency order:

```bash
bash packages/validate-all.sh
```

Requires the [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).
