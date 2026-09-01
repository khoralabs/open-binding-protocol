import { describe, expect, test } from "bun:test";
import { ObpError } from "@khoralabs/obp-core";
import { iface, portNames } from "../test-fixtures/offer-interface.ts";
import {
  applyRenameFamily,
  applyRenameFamilyToInterface,
  choice,
  compose,
  composeRenameFamilies,
  fromExposesBinds,
  hide,
  parallel,
  rename,
  setsEqual,
} from "./index.ts";

describe("sequential ∘ₚ — in(O₂∘O₁) = in(O₁) ∪ (in(O₂) − {p})", () => {
  const fixtures = [
    {
      o1: iface(["a"], ["p", "x"]),
      o2: iface(["p", "b"], ["y"]),
      p: "p",
      expectedIn: ["a", "b"],
      expectedOut: ["x", "y"],
    },
    {
      o1: iface([], ["glue"]),
      o2: iface(["glue", "z"], ["out2"]),
      p: "glue",
      expectedIn: ["z"],
      expectedOut: ["out2"],
    },
    {
      o1: iface(["i1", "i2"], ["shared", "o1"]),
      o2: iface(["shared"], ["o2a", "o2b"]),
      p: "shared",
      expectedIn: ["i1", "i2"],
      expectedOut: ["o1", "o2a", "o2b"],
    },
  ] as const;

  for (const [index, fx] of fixtures.entries()) {
    test(`fixture ${index + 1}`, () => {
      const result = compose(fx.o2, fx.o1, fx.p);
      expect(portNames(result).in).toEqual([...fx.expectedIn].sort());
      expect(portNames(result).out).toEqual([...fx.expectedOut].sort());
    });
  }
});

describe("sequential guard — compose throws when glue missing", () => {
  test("p ∉ out(O1)", () => {
    expect(() => compose(iface(["p"], ["y"]), iface([], ["x"]), "p")).toThrow(ObpError);
  });

  test("p ∉ in(O2)", () => {
    expect(() => compose(iface([], ["y"]), iface([], ["x"]), "p")).toThrow(ObpError);
  });
});

describe("parallel ⊗ — union and associativity", () => {
  const o1 = iface(["a"], ["x"]);
  const o2 = iface(["b"], ["y"]);
  const o3 = iface(["c"], ["z"]);

  test("in/out are set unions", () => {
    const result = parallel(o1, o2);
    expect(portNames(result)).toEqual({ in: ["a", "b"], out: ["x", "y"] });
  });

  test("(O₁⊗O₂)⊗O₃ = O₁⊗(O₂⊗O₃)", () => {
    const left = parallel(parallel(o1, o2), o3);
    const right = parallel(o1, parallel(o2, o3));
    expect(setsEqual(left.in, right.in)).toBe(true);
    expect(setsEqual(left.out, right.out)).toBe(true);
  });
});

describe("hide — subtract P; idempotent on same P", () => {
  const o = iface(["a", "h"], ["x", "h"]);

  test("subtracts hidden ports from in and out", () => {
    const hidden = hide(o, ["h"]);
    expect(portNames(hidden)).toEqual({ in: ["a"], out: ["x"] });
  });

  test("idempotent on same P", () => {
    const once = hide(o, ["h"]);
    const twice = hide(once, ["h"]);
    expect(portNames(twice)).toEqual(portNames(once));
  });
});

describe("rename f — in/out = f applied; rename(f,rename(g)) = rename(f∘g)", () => {
  const o = iface(["in_a"], ["out_b"]);

  test("relabels both sides", () => {
    const f = (n: string) => `ns:${n}`;
    const result = rename(o, f);
    expect(portNames(result)).toEqual({ in: ["ns:in_a"], out: ["ns:out_b"] });
  });

  test("rename(f, rename(g)) equals rename(f∘g)", () => {
    const g = (n: string) => `g.${n}`;
    const f = (n: string) => `f.${n}`;
    const composed = rename(o, composeRenameFamilies(f, g));
    const nested = rename(rename(o, g), f);
    expect(setsEqual(composed.in, nested.in)).toBe(true);
    expect(setsEqual(composed.out, nested.out)).toBe(true);
  });
});

describe("choice + — interface-level union (no exclusivity in core)", () => {
  test("matches parallel on sets", () => {
    const o1 = iface(["a"], ["x"]);
    const o2 = iface(["b"], ["y"]);
    const c = choice(o1, o2);
    const p = parallel(o1, o2);
    expect(setsEqual(c.in, p.in)).toBe(true);
    expect(setsEqual(c.out, p.out)).toBe(true);
  });
});

describe("fromExposesBinds — graph projection", () => {
  test("binds → in, exposes → out", () => {
    const o = fromExposesBinds(["e1", "e2"], ["b1"]);
    expect(portNames(o)).toEqual({ in: ["b1"], out: ["e1", "e2"] });
  });
});

describe("ℱ applyRenameFamily — unknown pass-through; composability after rename", () => {
  test("unknown names pass through", () => {
    const family = new Map([["a", "A"]]);
    expect(applyRenameFamily("a", family)).toBe("A");
    expect(applyRenameFamily("z", family)).toBe("z");
  });

  test("applyRenameFamilyToInterface reindexes boundary", () => {
    const o = iface(["req"], ["exp"]);
    const family = new Map([
      ["req", "buyer.req"],
      ["exp", "buyer.exp"],
    ]);
    const renamed = applyRenameFamilyToInterface(o, family);
    expect(portNames(renamed)).toEqual({
      in: ["buyer.req"],
      out: ["buyer.exp"],
    });
  });

  test("composability after rename when f(out₁) ∩ in₂ ≠ ∅", () => {
    const o1 = iface([], ["quote"]);
    const o2 = iface(["buyer.quote"], []);
    const family = new Map([["quote", "buyer.quote"]]);
    const renamed = applyRenameFamilyToInterface(o1, family);
    const glue = [...renamed.out].filter((p) => o2.in.has(p));
    expect(glue).toEqual(["buyer.quote"]);
  });
});
