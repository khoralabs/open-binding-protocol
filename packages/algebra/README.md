# @khoralabs/obp-algebra

Open-system algebra for OBP: wiring calculus, port atoms, library commitments, and intersection proof stubs.

## Install

```bash
npm install @khoralabs/obp-algebra @khoralabs/obp-core
```

## Subpaths

| Import | Purpose |
|--------|---------|
| `@khoralabs/obp-algebra` | Barrel (`interface` + `atom`) |
| `@khoralabs/obp-algebra/interface` | `compose`, `parallel`, `hide`, `rename`, `choice`, `RenameFamily` |
| `@khoralabs/obp-algebra/atom` | `portAtom`, `Repertoire`, `structuralComposability` |
| `@khoralabs/obp-algebra/commitment` | `commitLibrary`, `proveMembership`, `verifyMembership` |
| `@khoralabs/obp-algebra/intersection` | PSI/ZK stubs (v1: interfaces + `NotImplementedIntersectionError`) |

Theory: [`docs/theory/algebra.md`](../../docs/theory/algebra.md).

## Example

```typescript
import { compose, offerInterface } from "@khoralabs/obp-algebra/interface";
import { portAtom, structuralComposability } from "@khoralabs/obp-algebra/atom";
import { commitLibrary, proveMembership } from "@khoralabs/obp-algebra/commitment";

const supplier = offerInterface(["raw"], ["quote"]);
const broker = offerInterface(["quote"], ["buyer.rfq"]);
const wired = compose(broker, supplier, "quote");

const atom = portAtom({
  polarity: "expose",
  schemaId: "procurement.v1",
  policyClass: "open",
  offerClass: "supplier",
  normName: "quote",
});

const commitment = commitLibrary([atom]);
const proof = proveMembership(atom, commitment);
```

## Invariant catalog

| Module | Test file | Laws |
|--------|-----------|------|
| `interface` | `interface-invariants.test.ts` | `∘ₚ`, `⊗`, hide, rename, `+`, ℱ |
| `atom` | `atom-invariants.test.ts` | `portAtom`, repertoire, `Comp` |
| `commitment` | `commitment-invariants.test.ts` | Merkle `Commit(ℒ)`, membership |
| `intersection` | `intersection-contract.test.ts` | Stub API contracts |
| integration | `algebra-invariants.integration.test.ts` | Cross-module path |

```bash
bun test packages/algebra
```

## Scope

Depends on `@khoralabs/obp-core` only. Does not import NBC, wire, Khora, or host products. Intersection crypto fills `./intersection` in a future release without breaking structural APIs.
