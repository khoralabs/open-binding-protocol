# OBP overview

Open Binding Protocol (OBP) models agents and services as a typed graph: Parties publish Offers that expose and bind named Ports.

## Graph model

```
Party ──EXTENDS──▶ Offer ──EXPOSES──▶ Port
                  Offer ──BINDS──▶   Port
```

| Node / edge | Meaning |
|-------------|---------|
| `Party` | Agent, organization, or service that publishes offers |
| `Offer` | Interface object — required ports (`in`) and exposed ports (`out`) |
| `Port` | Named interface point; OBP does not interpret port semantics |
| `EXTENDS` | Party owns this Offer |
| `EXPOSES` | Offer exports this Port |
| `BINDS` | Offer requires this Port (bind edge in persistence) |

An Offer is read as:

```
in(O)  = { p | O binds p }
out(O) = { p | O exposes p }
```

Two offers can connect when one exposes a port the other binds.

## Protocol layers

OBP splits into layers that map to Smithy namespaces and npm packages:

| Layer | Namespace | Package | Responsibility |
|-------|-----------|---------|----------------|
| Graph | `khora.obp` | `@khoralabs/obp-core` | Party/Offer/Port shapes, persistence |
| Convention | `khora.obp.nbc` | `@khoralabs/obp-nbc` | When a bind is admissible (expiry, capacity, payload validation) |
| Transport | `khora.obp.frame`, `khora.obp.session` | `@khoralabs/obp-wire` | Signed Frame DAG, session Merkle log |
| Interface ops | — | `@khoralabs/obp-algebra` | Port-set composition, atoms, Merkle library commitments (optional) |

With NBC, peers co-author a signed Frame DAG. Each TURN chains via `p_hash` and is signed by its sender. Accepted effects project into the persistence graph.

A deployment may use the graph layer alone. NBC and wire are additive conformance layers. See [layering.md](./layering.md).

## What OBP does not define

Policy, authorization, execution, and business semantics sit above the graph. NBC adds bind-window and capacity rules but not host policy. Wire adds transport integrity, not application logic.

## Further reading

| Topic | Doc |
|-------|-----|
| Layer boundaries and dependencies | [layering.md](./layering.md) |
| `compose`, `parallel`, port atoms, commitments | [algebra.md](./algebra.md) |
| HLC peer time for NBC expiry | [peer-time.md](./peer-time.md) |
| MLS / transport confidentiality | [transport-confidentiality.md](./transport-confidentiality.md) |
| Normative shapes | [../spec/](../README.md#spec) |
| Package index | [../../packages/README.md](../../packages/README.md) |
