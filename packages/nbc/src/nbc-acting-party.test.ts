import { describe, expect, test } from "bun:test";
import { availablePortsFor, whoShouldAct } from "./nbc-acting-party";
import type { NbcChainGraph } from "./nbc-chain-graph-types";

function graph(partial: Partial<NbcChainGraph>): NbcChainGraph {
  return {
    parties: [
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
    ],
    offers: [],
    ports: [],
    extends: [],
    exposes: [],
    binds: [],
    ...partial,
  };
}

describe("whoShouldAct", () => {
  test("empty graph → initiator", () => {
    expect(whoShouldAct(graph({}), { initiatorId: "alice" })).toBe("alice");
  });

  test("after opening expose → counterparty", () => {
    const g = graph({
      offers: [
        {
          id: "o1",
          type: "opening",
          partyId: "alice",
          expires_turn: 0,
          expires_at_ms: 0,
        },
      ],
      ports: [
        {
          id: "p1",
          kind: "slot",
          promise: "pick",
          ref: "",
          expires_turn: 0,
          expires_at_ms: 0,
          exposedOnOfferIds: ["o1"],
          bindCount: 0,
          max_bindings: 1,
        },
      ],
      exposes: [{ offerId: "o1", portId: "p1" }],
    });
    expect(whoShouldAct(g, { initiatorId: "alice" })).toBe("bob");
    expect(availablePortsFor("bob", g).map((p) => p.id)).toEqual(["p1"]);
    expect(availablePortsFor("alice", g)).toEqual([]);
  });

  test("exhausted capacity → null", () => {
    const g = graph({
      offers: [
        {
          id: "o1",
          type: "opening",
          partyId: "alice",
          expires_turn: 0,
          expires_at_ms: 0,
        },
      ],
      ports: [
        {
          id: "p1",
          kind: "slot",
          promise: "pick",
          ref: "",
          expires_turn: 0,
          expires_at_ms: 0,
          exposedOnOfferIds: ["o1"],
          bindCount: 1,
          max_bindings: 1,
        },
      ],
      exposes: [{ offerId: "o1", portId: "p1" }],
      binds: [{ offerId: "o2", portId: "p1", bind_payload: null }],
    });
    expect(whoShouldAct(g, { initiatorId: "alice" })).toBeNull();
  });
});
