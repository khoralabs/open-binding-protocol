import { describe, expect, test } from "bun:test";
import { portAtomFromName } from "../atom/port-atom.ts";
import {
  commitLibrary,
  proveMembership,
  verifyMembership,
  verifyMembershipInCommitment,
} from "./index.ts";

const a = portAtomFromName("expose", "alpha", {
  schemaId: "s",
  policyClass: "p",
  offerClass: "o",
});
const b = portAtomFromName("expose", "beta", {
  schemaId: "s",
  policyClass: "p",
  offerClass: "o",
});
const c = portAtomFromName("require", "gamma", {
  schemaId: "s",
  policyClass: "p",
  offerClass: "o",
});

describe("commitLibrary determinism", () => {
  test("same multiset → same root", () => {
    const c1 = commitLibrary([b, a]);
    const c2 = commitLibrary([a, b]);
    expect(c1.root).toBe(c2.root);
    expect(c1.leaves).toEqual([...new Set([a, b])].sort());
  });

  test("order permutation invariance", () => {
    const forward = commitLibrary([a, b, c]);
    const backward = commitLibrary([c, b, a]);
    expect(forward.root).toBe(backward.root);
  });
});

describe("commitLibrary binding — different sets → different roots", () => {
  test("distinct libraries differ", () => {
    const c1 = commitLibrary([a]);
    const c2 = commitLibrary([b]);
    expect(c1.root).not.toBe(c2.root);
  });
});

describe("commitLibrary edge cases", () => {
  test("empty library", () => {
    const empty = commitLibrary([]);
    expect(empty.leaves).toEqual([]);
    expect(empty.root.length).toBeGreaterThan(0);
    expect(commitLibrary([]).root).toBe(empty.root);
  });

  test("singleton library", () => {
    const single = commitLibrary([a]);
    expect(single.leaves).toEqual([a]);
    const proof = proveMembership(a, single);
    expect(proof).not.toBeNull();
    if (proof) {
      expect(verifyMembership(proof)).toBe(true);
    }
  });
});

describe("membership soundness — verify succeeds for all x ∈ ℒ", () => {
  test("full library sweep", () => {
    const commitment = commitLibrary([a, b, c]);
    for (const leaf of commitment.leaves) {
      const proof = proveMembership(leaf, commitment);
      expect(proof).not.toBeNull();
      if (proof) {
        expect(verifyMembershipInCommitment(proof, commitment)).toBe(true);
      }
    }
  });
});

describe("membership completeness — verify fails for y ∉ ℒ", () => {
  test("non-member returns null proof", () => {
    const commitment = commitLibrary([a, b]);
    expect(proveMembership(c, commitment)).toBeNull();
  });

  test("wrong root fails verify", () => {
    const commitment = commitLibrary([a]);
    const other = commitLibrary([b]);
    const proof = proveMembership(a, commitment);
    expect(proof).not.toBeNull();
    if (proof) {
      const tampered = { ...proof, root: other.root };
      expect(verifyMembershipInCommitment(tampered, commitment)).toBe(false);
    }
  });
});

describe("membership consistency — tampered path fails verify", () => {
  test("bit-flip on sibling hash", () => {
    const commitment = commitLibrary([a, b, c]);
    const proof = proveMembership(b, commitment);
    expect(proof).not.toBeNull();
    if (!proof || proof.path.length === 0) return;

    const step = proof.path[0];
    if (!step) return;
    const flipped = step.sibling.slice(0, -1) + (step.sibling.endsWith("a") ? "b" : "a");
    const bad = {
      ...proof,
      path: [{ ...step, sibling: flipped }],
    };
    expect(verifyMembership(bad)).toBe(false);
  });
});
