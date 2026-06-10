# OBP — NBC implementations

TypeScript helpers for **Negotiated Binding Convention** in **bilateral** (two-peer) sessions: `NbcTurnBody` parsing, bind-time checks (N1–N6), `applyNbcTurn`, and read helpers for natural session stop.

- **`ts/`** — [`@khoralabs/obp-nbc`](ts/package.json). Smithy: [`../spec`](../spec).

**N2/N5/N6:** `validateNbcBind` enforces canonical `max_bindings` tally (N2/N5). Atomic cap enforcement under concurrent `bindPort` / `extendOffer` is N6 in `@khoralabs/obp-persistence` and `@khoralabs/obp-sqlite-persistence` strategies.
