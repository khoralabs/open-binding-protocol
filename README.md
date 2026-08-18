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
| `@khoralabs/obp-core` | Errors, primitives, model types, byte-stream; `./persistence`, `./sqlite` |
| `@khoralabs/obp-nbc` | NBC bind-time checks, `applyNbcTurn`, Standard Schema turn profiles, snapshot helpers; `./bind-policy` validators |
| `@khoralabs/obp-wire` | Frame DAG + session Merkle; `./http2`, `./ws` transport bindings |
| `@khoralabs/obp-react` | React NBC chain visualization (XYFlow) |

Theory and Smithy specs: [`docs/`](docs/README.md). Package index: [`packages/README.md`](packages/README.md).

## Setup

```bash
bun install
```

## Development

```bash
bun run check:write     # format (Biome)
bun run check           # lint/format check
bun run typecheck       # tsc across all packages
bun test                # all tests
bash docs/spec/validate.sh   # Smithy (requires Smithy CLI)
```

Husky wires `check` on pre-commit and `check + typecheck + test` on pre-push.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).
