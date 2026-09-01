# OBP algebra

`@khoralabs/obp-algebra` is the **open-system interface calculus** for OBP: wiring offers by port names, canonical port atoms, library commitments, and (future) oblivious intersection proofs. It depends on `@khoralabs/obp-core` only — not NBC, wire, or product stacks.

## Subpaths

| Export | Role |
|--------|------|
| `@khoralabs/obp-algebra` | Barrel: `./interface` + `./atom` |
| `@khoralabs/obp-algebra/interface` | Wiring calculus + rename family ℱ |
| `@khoralabs/obp-algebra/atom` | Port atoms, repertoire, structural composability |
| `@khoralabs/obp-algebra/commitment` | Merkle `Commit(ℒ)` + membership proofs |
| `@khoralabs/obp-algebra/intersection` | PSI/ZK stub interfaces (v1) |

NBC governs **when a bind is admissible** in negotiation. Algebra governs **interface geometry** independent of turns, policy, or transport.

## Minimal formal shape

```
in(O)  = { p | O requires p }
out(O) = { p | O exposes p }

O₂ ∘ₚ O₁  when O₁ exposes p and O₂ requires p
```

## Wiring calculus

### Sequential composition

```
in(O₂ ∘ₚ O₁)  = in(O₁) ∪ (in(O₂) − {p})
out(O₂ ∘ₚ O₁) = (out(O₁) − {p}) ∪ out(O₂)
```

### Parallel composition

```
in(O₁ ⊗ O₂)  = in(O₁) ∪ in(O₂)
out(O₁ ⊗ O₂) = out(O₁) ∪ out(O₂)
```

### Hiding

```
in(hide P in O)  = in(O)  − P
out(hide P in O) = out(O) − P
```

### Relabeling

```
in(rename f in O)  = f(in(O))
out(rename f in O) = f(out(O))
```

### Choice

At the interface level, `O₁ + O₂` unions `in` and `out`. OBP core does not enforce mutual exclusion; hosts decide whether binding one port disables siblings.

## Port atoms

Canonical atom:

```
π = H(domain ‖ polarity ‖ schemaId ‖ policyClass ‖ offerClass ‖ normName)
```

Polarities: `expose` | `require`. Atoms are comparable across agents when class fields align.

## Structural composability

Plaintext predicate (host-local or pre-commitment):

```
Comp(A, B)  ⇔  out(A) ∩ in(B) ≠ ∅
```

After rename family ℱ on A's boundary: compare `f(out(A))` with `in(B)`.

## Commitments

`commitLibrary(ℒ)` returns a deterministic Merkle root over sorted unique atoms. Membership proofs demonstrate `π ∈ ℒ` without revealing other library members.

Domain tags (aligned with `portAtom`):

- `khora.obp.algebra.merkle-leaf.v1`
- `khora.obp.algebra.merkle-node.v1`

## Intersection (future)

`./intersection` will prove composability potential over committed libraries:

```
∃ π. π ∈ out(A) ∧ π ∈ in(B)
```

without disclosing full repertoires. v1 exports interfaces and documents intent only.

## Invariant catalog

Each subpath ships `*-invariants.test.ts` (or `intersection-contract.test.ts`) enforcing:

| Subpath | Laws |
|---------|------|
| `interface` | Sequential, parallel, hide, rename, choice, ℱ, compose guards |
| `atom` | Determinism, domain separation, repertoire polarity, composability |
| `commitment` | Deterministic root, order invariance, membership soundness/completeness |
| `intersection` | Stub contracts, predicate alignment with structural composability |

Run: `bun test packages/algebra`

## Relationship to NBC

```
algebra (interface geometry)
    ↓ optional
commitment / intersection (private glue proofs)
    ↓ separate layer
NBC (bind admissibility in negotiation)
    ↓
wire (signed frames)
```

An OBP stack may use algebra without NBC or intersection. NBC does not replace algebra; it constrains binds projected into the persistence graph.
