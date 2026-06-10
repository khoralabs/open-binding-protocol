# `@khoralabs/nbc-bind-policy`

**AJV** validation of NBC **bind** JSON payloads against a **JSON Schema (draft 2020-12)** stored on a port's **`bind_policy`**. NBC hosts use this so malformed bind data fails before it reaches session logic.

Exports **`validateNbcBindPayloadForPort`**, schema constants, **`stableStringify`** for deterministic hashing/signing surfaces, and **`formatAjvErrorsForAgent`** for readable validation errors.

## Scripts

- `bun test` — AJV + golden tests
- `bun run typecheck` — `tsc --noEmit`

Barrel: [`src/index.ts`](src/index.ts).
