# `@khoralabs/nbc-bind-policy`

**AJV** validation of NBC **`bind_payload`** JSON against a **JSON Schema (draft 2020-12)** stored on a port's **`bind_policy`**.

## Who validates what

| When | Where | What |
|------|--------|------|
| Port expose | `ObpPersistence` (`validateBindPolicyAtExpose`) | Compile-check that **`bind_policy`** is a well-formed JSON Schema |
| Outbound TURN (sender) | Frame multiplexer (`validateOutboundNbcTurnBind` before send) | Early fail-fast for honest clients; optional hygiene only |
| Inbound TURN (receiver) | Frame multiplexer (`applyNbcTurn` → `normalizeNbcBindPayload`) | **Authoritative** — invalid binds are rejected and not persisted |

**"Host"** means the bilateral NBC endpoint (daemon/client running the frame multiplexer + local persistence), not the relay. The relay forwards opaque bytes (MLS `mls1` envelopes or plaintext multiplex) and never runs AJV on wire payloads.

The **receiving peer** validates `bind_payload` against the port's `bind_policy` on the logical TURN body (after MLS decrypt when the MLS hub profile is in use) before `bindPort` writes a row. Configure **`validateBindPayload`** (typically `validateNbcBindPayloadForPort`) on every multiplexer that may accept binds to ports with an active policy; without it, active policies fail closed at apply time.

`bind_policy` is public port metadata (the schema contract). `bind_payload` lives in logical TURN bodies between the two session parties.

## Exports

**`validateNbcBindPayloadForPort`**, **`validateBindPolicyAtExpose`**, **`stableStringify`** + **`SCHEMA_CACHE_CANONICAL_JSON`** (sorted-key JSON for AJV compile-cache keys; omits `undefined` object properties), and **`formatAjvErrorsForAgent`**.

Frame signing canonical JSON (`undefined` → `null`) lives in **`@khoralabs/obp-frames-impl`** (`canonicalJsonString` / `canonicalJsonUtf8`), not in this package.

AJV runs with **`strict: true`**; unknown schema keywords fail at compile time.

## Scripts

- `bun test` — AJV + golden tests
- `bun run typecheck` — `tsc --noEmit`

Barrel: [`src/index.ts`](src/index.ts).
