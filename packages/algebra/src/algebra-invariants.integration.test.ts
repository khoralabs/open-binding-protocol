import { describe, expect, test } from "bun:test";
import {
  commitLibrary,
  proveMembership,
  verifyMembershipInCommitment,
} from "./commitment/index.ts";
import {
  applyRenameFamilyToInterface,
  fromExposesBinds,
  offerInterface,
  portAtomFromName,
  Repertoire,
  structuralComposability,
  structuralComposabilityAfterRename,
  structuralGlueComposability,
} from "./index.ts";
import {
  acceptPolaritySplitCommitments,
  COMPOSABILITY_PREDICATE,
  NotImplementedIntersectionError,
  proveComposabilityPotential,
  renameAtomsForIntersection,
} from "./intersection/index.ts";

describe("algebra integration — interface → atom → commitment → intersection types", () => {
  test("end-to-end path", () => {
    const o = fromExposesBinds(["quote-out"], ["rfq-in"]);
    expect(o.out.has("quote-out")).toBe(true);
    expect(o.in.has("rfq-in")).toBe(true);

    const classes = {
      schemaId: "procurement.v1",
      policyClass: "open",
      offerClass: "supplier",
    };

    const outAtom = portAtomFromName("expose", "quote-out", classes);
    const inAtom = portAtomFromName("require", "rfq-in", classes);

    const rep = new Repertoire()
      .add("expose", { atom: outAtom, offerRef: "offer-1" })
      .add("require", { atom: inAtom });

    const peerOut = portAtomFromName("expose", "peer-out", classes);
    const peerIn = portAtomFromName("require", "peer-out", classes);

    const { composable, intersection } = structuralComposability(rep.outAtoms(), new Set([peerIn]));
    expect(composable).toBe(false);
    expect(intersection.size).toBe(0);

    const glueMatch = structuralGlueComposability(
      [{ normName: "quote-out", classes }],
      [{ normName: "quote-out", classes }],
    );
    expect(glueMatch.composable).toBe(true);

    const sharedGlue = portAtomFromName("expose", "shared-glue", classes);
    const { composable: match } = structuralComposability(
      new Set([sharedGlue]),
      new Set([sharedGlue]),
    );
    expect(match).toBe(true);

    const commitment = commitLibrary([...rep.outAtoms(), ...rep.inAtoms(), peerOut]);
    expect(commitment.leaves.length).toBe(3);

    const proof = proveMembership(outAtom, commitment);
    expect(proof).not.toBeNull();
    if (proof) {
      expect(verifyMembershipInCommitment(proof, commitment)).toBe(true);
    }

    const supplier = offerInterface([], ["quote"]);
    const renamed = applyRenameFamilyToInterface(supplier, new Map([["quote", "buyer.quote"]]));
    expect([...renamed.out]).toEqual(["buyer.quote"]);

    const renamedOut = renameAtomsForIntersection([outAtom], (atom) =>
      atom === outAtom ? inAtom : atom,
    );
    const afterRename = structuralComposabilityAfterRename([outAtom], [inAtom], (atom) =>
      atom === outAtom ? inAtom : atom,
    );
    expect(afterRename.composable).toBe(true);
    expect(renamedOut).toEqual([inAtom]);

    const split = acceptPolaritySplitCommitments({
      out: commitLibrary(rep.outAtoms()),
      in: commitLibrary(rep.inAtoms()),
    });
    expect(split.out.root).toBeTruthy();
    expect(COMPOSABILITY_PREDICATE).toContain("out(A)");

    expect(() =>
      proveComposabilityPotential({
        localOutCommitment: split.out,
        peerInCommitment: split.in,
      }),
    ).toThrow(NotImplementedIntersectionError);
  });
});
