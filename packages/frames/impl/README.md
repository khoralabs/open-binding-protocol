# OBP — frame implementations

Language-specific implementations for the frame protocol live under this directory.

- **`ts/`** — TypeScript package [`@khoralabs/obp-frames-impl`](ts/package.json): **`khora.obp.frame`** wire types (`Frame`, `FrameType` including **`END_OFFERS`**, `SessionInit`, …), **`canonical_json`**, length-prefixed framing, **`signing_bytes`** / DAG **tip** helpers, and **`SessionInit`** pubkey-order checks. Shared types: `JsonDocument` from **`@khoralabs/obp-model`**, `Sha256HexLower` / hex / SHA helpers from **`@khoralabs/obp-primitives`**. Smithy source of truth: [`../spec`](../spec). Workspace consumers today include **`@khoralabs/obp-session-impl`**.

Other runtimes (e.g. Go) can add sibling folders later without moving `ts/`.
