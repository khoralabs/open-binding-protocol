# `@khoralabs/nbc-bind-policy`

**AJV** validation of NBC **bind** JSON payloads against a **JSON Schema (draft 2020-12)** stored on a port's **`bind_policy`**. NBC hosts use this so malformed bind data fails before it reaches session logic.

Exports **`validateNbcBindPayloadForPort`**, **`validateBindPolicyAtExpose`** (compile-check at port expose), schema constants, **`stableStringify`** (`SCHEMA_CACHE_CANONICAL_JSON` — omits `undefined` keys), and **`formatAjvErrorsForAgent`**. Shared canonical JSON lives in **`@khoralabs/canonical-json`** (frame signing uses **`FRAME_SIGNING_CANONICAL_JSON`** / `undefined` → `null`).

AJV runs with **`strict: true`**; unknown schema keywords fail at compile time. **`ObpPersistence`** strategies call **`validateBindPolicyAtExpose`** when a new port row is created.

## Scripts

- `bun test` — AJV + golden tests
- `bun run typecheck` — `tsc --noEmit`

Barrel: [`src/index.ts`](src/index.ts).
