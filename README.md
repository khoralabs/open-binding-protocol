# OBP — Open Binding Protocol

Typed graph of Parties, Offers, and Ports, with optional Negotiated Binding Convention (NBC) and wire packages.

## Table of Contents

- [Background](#background)
- [Packages](#packages)
- [Install](#install)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

A **Party** publishes **Offers**. Each Offer **exposes** Ports it provides and **binds** Ports it requires. A bind creates an edge in the persistence graph from a requiring Offer to an exposed Port.

```
Party ──EXTENDS──▶ Offer ──EXPOSES──▶ Port
                  Offer ──BINDS──▶   Port
```

Read an Offer as a module with imports and exports: required ports are `in(O)`, exposed ports are `out(O)`.

With **NBC** (Negotiated Binding Convention), peers exchange signed **Frames** in a chained DAG (`p_hash` links each TURN to its predecessor). Accepted TURN effects are projected into the OBP persistence graph.

OBP core is the graph model and store. Policy, authorization, expiry, and execution live in host layers or optional packages (NBC, wire).

### Protocol layers

| Layer | Smithy namespace | Package |
|-------|------------------|---------|
| Graph | `khora.obp` | `@khoralabs/obp-core` |
| Convention | `khora.obp.nbc` | `@khoralabs/obp-nbc` |
| Transport | `khora.obp.frame`, `khora.obp.session` | `@khoralabs/obp-wire` |
| Interface ops (optional) | — | `@khoralabs/obp-algebra` |

A stack may be OBP-conformant without NBC. See [docs/theory/layering.md](docs/theory/layering.md) and [docs/](docs/README.md).

## Packages

| Package | Role |
|---------|------|
| `@khoralabs/obp-core` | Errors, primitives, model types, byte-stream; `./persistence`, `./sqlite` |
| `@khoralabs/obp-algebra` | `compose` / `parallel` / `hide` / `rename` / `choice`, port atoms, Merkle library commitments; `./interface`, `./atom`, `./commitment`, `./intersection` |
| `@khoralabs/obp-nbc` | NBC bind-time checks, `applyNbcTurn`, Standard Schema turn profiles; `./bind-policy` |
| `@khoralabs/obp-wire` | Frame DAG + session Merkle log; `./http2`, `./ws` |
| `@khoralabs/obp-react` | React NBC chain visualization (XYFlow) |

Package index: [`packages/README.md`](packages/README.md).

## Install

```bash
bun install
```

Published packages install individually, for example:

```bash
npm install @khoralabs/obp-core
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

## License

MIT
