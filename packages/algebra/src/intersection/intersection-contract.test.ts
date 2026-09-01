import { describe, expect, test } from "bun:test";
import { structuralComposability } from "../atom/composability.ts";
import { portAtomFromName } from "../atom/port-atom.ts";
import { commitLibrary } from "../commitment/index.ts";
import {
  acceptPolaritySplitCommitments,
  COMPOSABILITY_PREDICATE,
  NotImplementedIntersectionError,
  proveComposabilityPotential,
  verifyComposabilityPotential,
} from "./index.ts";

describe("intersection stub exports throw notImplemented", () => {
  test("proveComposabilityPotential", () => {
    expect(() =>
      proveComposabilityPotential({
        localOutCommitment: commitLibrary([]),
        peerInCommitment: commitLibrary([]),
      }),
    ).toThrow(NotImplementedIntersectionError);
  });

  test("verifyComposabilityPotential", () => {
    expect(() =>
      verifyComposabilityPotential({
        proofBytes: new Uint8Array(),
        publicInputs: {
          localOutRoot: "abc",
          peerInRoot: "def",
          minCardinality: 1,
        },
      }),
    ).toThrow(NotImplementedIntersectionError);
  });
});

describe("intersection types accept commitment roots + polarity split", () => {
  test("acceptPolaritySplitCommitments", () => {
    const atom = portAtomFromName("expose", "x", {
      schemaId: "",
      policyClass: "",
      offerClass: "",
    });
    const split = acceptPolaritySplitCommitments({
      out: commitLibrary([atom]),
      in: commitLibrary([]),
    });
    expect(split.out.leaves).toEqual([atom]);
  });
});

describe("documented predicate matches structuralComposability intent", () => {
  test("COMPOSABILITY_PREDICATE describes out∩in glue", () => {
    expect(COMPOSABILITY_PREDICATE).toContain("out(A)");
    expect(COMPOSABILITY_PREDICATE).toContain("in(B)");
  });

  test("plaintext composability aligns with future proof statement", () => {
    const outAtom = portAtomFromName("expose", "glue", {
      schemaId: "s",
      policyClass: "p",
      offerClass: "o",
    });
    const inAtom = outAtom;
    const { composable } = structuralComposability([outAtom], [inAtom]);
    expect(composable).toBe(true);
  });
});
