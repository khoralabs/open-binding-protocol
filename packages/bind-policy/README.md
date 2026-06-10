# `@khoralabs/nbc-bind-policy`

**AJV** validation of NBC **`bind_payload`** JSON against a **JSON Schema (draft 2020-12)** stored on a port's **`bind_policy`**.

## Who validates what

| When | Where | What |
|------|--------|------|
| Port expose | `ObpPersistence` (`validateBindPolicyAtExpose`) | Compile-check that **`bind_policy`** is a well-formed JSON Schema |
| Outbound TURN (sender) | Frame multiplexer (`validateOutboundNbcTurnBind` before encrypt) | Early fail-fast for honest clients; optional hygiene only |
| Inbound TURN (receiver) | Frame multiplexer (`applyNbcTurn` → `normalizeNbcBindPayload`) | **Authoritative** — invalid binds are rejected and not persisted |

**"Host"** means the bilateral NBC endpoint (daemon/client running the frame multiplexer + local persistence), not the frame relay. The relay forwards **E2EE ciphertext** and never runs AJV on wire payloads.

After E2EE decrypt, the **receiving peer** validates `bind_payload` against the port's `bind_policy` before `bindPort` writes a row. A malicious sender can still transmit invalid ciphertext; only the receiver's apply path decides whether a bind succeeds. Configure **`validateBindPayload`** (typically `validateNbcBindPayloadForPort`) on every multiplexer that may accept binds to ports with an active policy; without it, active policies fail closed at apply time.

`bind_policy` is public port metadata (the schema contract). `bind_payload` lives inside E2EE TURN bodies between the two session parties.

## Exports

**`validateNbcBindPayloadForPort`**, **`validateBindPolicyAtExpose`**, schema constants, **`stableStringify`** (`SCHEMA_CACHE_CANONICAL_JSON` — omits `undefined` keys), and **`formatAjvErrorsForAgent`**. Shared canonical JSON lives in **`@khoralabs/canonical-json`** (frame signing uses **`FRAME_SIGNING_CANONICAL_JSON`** / `undefined` → `null`).

AJV runs with **`strict: true`**; unknown schema keywords fail at compile time.

## Scripts

- `bun test` — AJV + golden tests
- `bun run typecheck` — `tsc --noEmit`

Barrel: [`src/index.ts`](src/index.ts).
