# OBP algebra

`@khoralabs/obp-algebra` provides port-set operations, canonical port atoms, Merkle library commitments, and intersection stubs. It depends on `@khoralabs/obp-core` only — not NBC or wire.

## Subpaths

| Export | Role |
|--------|------|
| `@khoralabs/obp-algebra` | Barrel: `./interface` + `./atom` |
| `@khoralabs/obp-algebra/interface` | `compose`, `parallel`, `hide`, `rename`, `choice`, `RenameFamily` |
| `@khoralabs/obp-algebra/atom` | `portAtom`, `Repertoire`, `structuralComposability` |
| `@khoralabs/obp-algebra/commitment` | `commitLibrary`, `proveMembership`, `verifyMembership` |
| `@khoralabs/obp-algebra/intersection` | Stub interfaces (v1 throws `NotImplementedIntersectionError`) |

NBC governs when a bind is admissible during negotiation. Algebra computes port boundaries on `OfferInterface` values independent of turns, policy, or transport.

## Port sets

```
in(O)  = { p | O requires p }
out(O) = { p | O exposes p }

O₂ ∘ₚ O₁  when O₁ exposes p and O₂ requires p
```

## Interface composition

Each operator maps to a function in `@khoralabs/obp-algebra/interface` ([`wiring.ts`](../../packages/algebra/src/interface/wiring.ts)).

### Sequential — `compose(o2, o1, p)`

Wire O₁'s exposed port `p` into O₂'s required port `p`. Port `p` is removed from the composed boundary.

```
in(O₂ ∘ₚ O₁)  = in(O₁) ∪ (in(O₂) − {p})
out(O₂ ∘ₚ O₁) = (out(O₁) − {p}) ∪ out(O₂)
```

### Parallel — `parallel(o1, o2)`

Union both port sets.

```
in(O₁ ⊗ O₂)  = in(O₁) ∪ in(O₂)
out(O₁ ⊗ O₂) = out(O₁) ∪ out(O₂)
```

### Hiding — `hide(o, ports)`

Remove ports from the external boundary (encapsulation).

```
in(hide P in O)  = in(O)  − P
out(hide P in O) = out(O) − P
```

### Relabeling — `rename(o, f)`

Apply `f : PortName → PortName` to both sets.

```
in(rename f in O)  = f(in(O))
out(rename f in O) = f(out(O))
```

### Choice — `choice(o1, o2)`

Union of ports (same as `parallel` at the type level). OBP core does not enforce mutual exclusion; hosts decide whether binding one port disables siblings.

## Port atoms

`portAtom(...)` produces a canonical hash:

```
π = H(domain ‖ polarity ‖ schemaId ‖ policyClass ‖ offerClass ‖ normName)
```

Polarities: `expose` | `require`. Atoms are comparable when class fields align.

## Structural composability

`structuralComposability(a, b)` checks:

```
Comp(A, B)  ⇔  out(A) ∩ in(B) ≠ ∅
```

After applying a `RenameFamily` on A's boundary: compare `f(out(A))` with `in(B)`.

## Library commitments

`commitLibrary(ℒ)` returns a deterministic Merkle root over sorted unique atoms. `proveMembership` / `verifyMembership` demonstrate `π ∈ ℒ` without revealing other library members.

Domain tags (aligned with `portAtom`):

- `khora.obp.algebra.merkle-leaf.v1`
- `khora.obp.algebra.merkle-node.v1`

## Intersection (stub)

`./intersection` exports interfaces for proving composability over committed libraries:

```
∃ π. π ∈ out(A) ∧ π ∈ in(B)
```

v1 throws `NotImplementedIntersectionError`; no crypto is shipped yet.

## Invariant catalog

Each subpath ships `*-invariants.test.ts` (or `intersection-contract.test.ts`):

| Subpath | Laws |
|---------|------|
| `interface` | Sequential, parallel, hide, rename, choice, ℱ, compose guards |
| `atom` | Determinism, domain separation, repertoire polarity, composability |
| `commitment` | Deterministic root, order invariance, membership soundness/completeness |
| `intersection` | Stub contracts, predicate alignment with structural composability |

Run: `bun test packages/algebra`

## Relationship to NBC and wire

```
algebra (port-set ops, optional)
    ↓
commitment / intersection (Merkle proofs; intersection stub)
    ↓ separate layer
NBC (bind admissibility)
    ↓
wire (signed frames)
```

An OBP stack may use algebra without NBC or intersection. NBC constrains binds projected into the persistence graph; it does not replace algebra.
