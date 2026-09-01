import { describe, expect, test } from "bun:test";
import { applyRenameFamilyToInterface } from "../interface/index.ts";
import { iface } from "../test-fixtures/offer-interface.ts";
import {
  portAtom,
  portAtomFromName,
  portGlueAtom,
  Repertoire,
  structuralComposability,
  structuralComposabilityAfterRename,
  structuralGlueComposability,
} from "./index.ts";

const baseClasses = {
  schemaId: "schema.v1",
  policyClass: "default",
  offerClass: "offer.procurement",
};

describe("portAtom determinism", () => {
  test("same input → same hex", () => {
    const input = {
      polarity: "expose" as const,
      normName: "quote",
      ...baseClasses,
    };
    expect(portAtom(input)).toBe(portAtom(input));
  });
});

describe("portAtom domain separation", () => {
  const base = {
    polarity: "expose" as const,
    normName: "quote",
    schemaId: "s",
    policyClass: "p",
    offerClass: "o",
  };

  test("differing fields → distinct atoms", () => {
    const atoms = new Set([
      portAtom(base),
      portAtom({ ...base, polarity: "require" }),
      portAtom({ ...base, schemaId: "s2" }),
      portAtom({ ...base, policyClass: "p2" }),
      portAtom({ ...base, offerClass: "o2" }),
      portAtom({ ...base, normName: "other" }),
    ]);
    expect(atoms.size).toBe(6);
  });

  test("expose vs require never collide for same norm fields", () => {
    const expose = portAtomFromName("expose", "quote", baseClasses);
    const require = portAtomFromName("require", "quote", baseClasses);
    expect(expose).not.toBe(require);
  });
});

describe("Repertoire polarity partition", () => {
  test("out/in disjoint; add/remove idempotent", () => {
    const rep = new Repertoire();
    const outAtom = portAtomFromName("expose", "a", baseClasses);
    const inAtom = portAtomFromName("require", "b", baseClasses);

    rep.add("expose", { atom: outAtom, offerRef: "o1" });
    rep.add("require", { atom: inAtom });

    expect(rep.has("expose", outAtom)).toBe(true);
    expect(rep.has("require", inAtom)).toBe(true);
    expect(rep.outAtoms().has(inAtom)).toBe(false);
    expect(rep.inAtoms().has(outAtom)).toBe(false);

    rep.add("expose", { atom: outAtom, offerRef: "o1-updated" });
    expect(rep.getOut().get(outAtom)?.offerRef).toBe("o1-updated");

    expect(rep.remove("expose", outAtom)).toBe(true);
    expect(rep.remove("expose", outAtom)).toBe(false);
  });
});

describe("structuralComposability — true iff out ∩ in ≠ ∅", () => {
  test("empty intersection", () => {
    const result = structuralComposability(["a"], ["b"]);
    expect(result.composable).toBe(false);
    expect(result.intersection.size).toBe(0);
  });

  test("singleton overlap", () => {
    const result = structuralComposability(["x", "y"], ["y", "z"]);
    expect(result.composable).toBe(true);
    expect([...result.intersection]).toEqual(["y"]);
  });

  test("partial overlap", () => {
    const result = structuralComposability(new Set(["a", "b"]), new Set(["b", "c"]));
    expect(result.composable).toBe(true);
    expect(result.intersection).toEqual(new Set(["b"]));
  });
});

describe("structuralGlueComposability — expose out vs require in on shared classes", () => {
  test("matches cross-polarity ports with same norm + classes", () => {
    const classes = { schemaId: "s", policyClass: "p", offerClass: "o" };
    const result = structuralGlueComposability(
      [{ normName: "quote", classes }],
      [{ normName: "quote", classes }],
    );
    expect(result.composable).toBe(true);
    expect(result.intersection).toEqual(new Set([portGlueAtom("quote", classes)]));
  });
});

describe("portAtomFromName partial classes", () => {
  test("omitted class fields default to empty strings", () => {
    const full = portAtomFromName("expose", "quote", {
      schemaId: "",
      policyClass: "",
      offerClass: "",
    });
    const partial = portAtomFromName("expose", "quote", {});
    expect(partial).toBe(full);
  });
});

describe("rename + composability bridges interface to atoms", () => {
  test("renamed out atoms match peer in after ℱ", () => {
    const outAtom = portAtomFromName("expose", "quote", baseClasses);
    const inAtom = portAtomFromName("require", "buyer.quote", baseClasses);

    const renameAtom = (atom: string) => (atom === outAtom ? inAtom : atom);

    const plain = structuralComposability([outAtom], [inAtom]);
    expect(plain.composable).toBe(false);

    const after = structuralComposabilityAfterRename([outAtom], [inAtom], renameAtom);
    expect(after.composable).toBe(true);
  });

  test("interface rename aligns port-level glue", () => {
    const o1 = iface([], ["quote"]);
    const o2 = iface(["buyer.quote"], []);
    const family = new Map([["quote", "buyer.quote"]]);
    const renamed = applyRenameFamilyToInterface(o1, family);
    const glue = [...renamed.out].filter((p) => o2.in.has(p));
    expect(glue.length).toBe(1);
  });
});
