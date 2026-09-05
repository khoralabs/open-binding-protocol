# OBP documentation

Documentation follows [Diátaxis](https://diataxis.fr): explanation pages describe concepts; spec pages are normative reference.

## Explanation (`theory/`)

| Doc | Topic |
|-----|-------|
| [overview.md](theory/overview.md) | Graph model, protocol layers, what OBP does not define |
| [layering.md](theory/layering.md) | Namespace ↔ package mapping, runtime projection, dependencies |
| [algebra.md](theory/algebra.md) | `compose` / `parallel` / port atoms / Merkle commitments |
| [peer-time.md](theory/peer-time.md) | HLC + NTP skew for NBC `expires_at_ms` |
| [transport-confidentiality.md](theory/transport-confidentiality.md) | MLS and transport profiles for frame channels |

## Reference (`spec/`)

Normative Smithy models:

| Directory | Namespace |
|-----------|-----------|
| `spec/model/` | `khora.obp` |
| `spec/persistence/` | `khora.obp.persistence` |
| `spec/nbc/` | `khora.obp.nbc` |
| `spec/frame/` | `khora.obp.frame` |
| `spec/session/` | `khora.obp.session` |
| `spec/transport/` | HTTP/2, WebSocket bindings |

Validate specs:

```sh
bash docs/spec/validate.sh
```

Requires the [Smithy CLI](https://smithy.io/2.0/guides/smithy-cli/cli_installation.html).

## Packages

Implementation lives under [`packages/`](../packages/README.md):

| Package | Role |
|---------|------|
| `@khoralabs/obp-core` | Graph types + persistence (`./persistence`, `./sqlite`) |
| `@khoralabs/obp-algebra` | Port-set ops, atoms, Merkle commitments |
| `@khoralabs/obp-nbc` | Negotiated Binding Convention + `./bind-policy` |
| `@khoralabs/obp-wire` | Frame/session runtime + `./http2`, `./ws` |

React UI: [`khoralabs/react/obp`](https://github.com/khoralabs/react) registry items.
