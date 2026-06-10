# OBP — NBC implementations

TypeScript helpers for **Negotiated Binding Convention** in **bilateral** (two-peer) sessions: `NbcTurnBody` parsing, bind-time checks (N1–N6), `applyNbcTurn`, and read helpers for natural session stop.

- **`ts/`** — [`@khoralabs/obp-nbc`](ts/package.json). Smithy: [`../spec`](../spec).

**N2/N5/N6:** `checkNbcBindAdmission` enforces N1–N3 and canonical `max_bindings` (N2/N5). `applyNbcTurn` passes it to `bindPort({ assertAdmissible })` so admission and insert share one store transaction (N6). Direct `bindPort` callers without `assertAdmissible` still get capacity checks in the strategy.
