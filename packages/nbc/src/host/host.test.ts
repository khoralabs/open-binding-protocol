import { describe, expect, test } from "bun:test";

import type { NbcChainGraph } from "../nbc-chain-graph-types.ts";
import { negotiationOutputToWire } from "./action.ts";
import { parseNegotiationTurnEnvelope } from "./turn-output-schema.ts";
import { availablePeerPorts, clampMaxTurns, whoShouldActWithChainState } from "./who-should-act.ts";

function emptyGraph(): NbcChainGraph {
  return { parties: [], offers: [], ports: [], binds: [], extends: [], exposes: [] };
}

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

const openChain = {
  status: "open",
  initiatorDid: "alice",
  counterpartyDid: "bob",
  turnsCompleted: 0,
  maxTurns: 6,
} as const;

describe("whoShouldActWithChainState", () => {
  test("returns not-open when chain is closed", () => {
    expect(whoShouldActWithChainState(emptyGraph(), { ...openChain, status: "closed" })).toEqual({
      did: null,
      reason: "not-open",
    });
  });

  test("returns initiator-open on empty graph", () => {
    expect(whoShouldActWithChainState(emptyGraph(), openChain)).toEqual({
      did: "alice",
      reason: "initiator-open",
    });
  });

  test("returns terminal-bind when binds exist", () => {
    expect(
      whoShouldActWithChainState(
        graph({
          binds: [{ offerId: "o1", portId: "p1", bind_payload: null }],
        }),
        openChain,
      ),
    ).toEqual({ did: null, reason: "terminal-bind" });
  });

  test("returns error when ports exhausted and binds empty", () => {
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
      binds: [],
    });
    expect(whoShouldActWithChainState(g, { ...openChain, turnsCompleted: 1 })).toEqual({
      did: null,
      reason: "error",
    });
  });

  test("returns error when counterparty missing from parties", () => {
    const g = graph({
      parties: [{ id: "alice", name: "Alice" }],
      offers: [
        {
          id: "o1",
          type: "opening",
          partyId: "alice",
          expires_turn: 0,
          expires_at_ms: 0,
        },
      ],
      binds: [],
    });
    expect(whoShouldActWithChainState(g, { ...openChain, turnsCompleted: 1 })).toEqual({
      did: null,
      reason: "error",
    });
  });
});

describe("clampMaxTurns", () => {
  test("caps at NBC_MAX_TURNS_CAP", () => {
    expect(clampMaxTurns(99)).toBe(10);
  });
});

describe("availablePeerPorts", () => {
  test("maps counterparty-exposed ports for the acting party", () => {
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
          bind_policy: { required: ["x"] },
        },
      ],
      exposes: [{ offerId: "o1", portId: "p1" }],
    });
    expect(availablePeerPorts(g, "bob")).toEqual([
      {
        id: "p1",
        type: "slot",
        promise: "pick",
        partyId: "alice",
        bind_policy: { required: ["x"] },
      },
    ]);
    expect(availablePeerPorts(g, "alice")).toEqual([]);
  });
});

describe("parseNegotiationTurnEnvelope", () => {
  test("accepts opening expose", () => {
    expect(
      parseNegotiationTurnEnvelope(
        { expose: [{ kind: "slot", promise: "pick" }] },
        { opening: true, peerPorts: [] },
      ),
    ).toEqual({ expose: [{ kind: "slot", promise: "pick" }] });
  });

  test("accepts disconnect on opening turn", () => {
    expect(
      parseNegotiationTurnEnvelope({ disconnect: true }, { opening: true, peerPorts: [] }),
    ).toEqual({ disconnect: true });
  });

  test("accepts continue bind and disconnect on later turns", () => {
    const peerPorts = [
      {
        id: "p1",
        type: "slot",
        promise: "pick",
        partyId: "alice",
        bind_policy: null,
      },
    ];
    expect(
      parseNegotiationTurnEnvelope({ bind: { portId: "p1" } }, { opening: false, peerPorts }),
    ).toEqual({ bind: { portId: "p1", payload: {} } });
    expect(
      parseNegotiationTurnEnvelope({ disconnect: true }, { opening: false, peerPorts }),
    ).toEqual({ disconnect: true });
  });

  test("accepts continue bind when peerPorts is empty", () => {
    expect(
      parseNegotiationTurnEnvelope({ bind: { portId: "p1" } }, { opening: false, peerPorts: [] }),
    ).toEqual({ bind: { portId: "p1", payload: {} } });
  });

  test("rejects expose-only body on non-opening turn with empty peerPorts", () => {
    expect(() =>
      parseNegotiationTurnEnvelope(
        { expose: [{ kind: "slot", promise: "pick" }] },
        { opening: false, peerPorts: [] },
      ),
    ).toThrow(/bind\.portId is required/);
  });
});

describe("negotiationOutputToWire", () => {
  test("serializes disconnect on opening", () => {
    expect(
      negotiationOutputToWire({
        raw: { disconnect: true },
        opening: true,
        peerPorts: [],
      }),
    ).toEqual({ kind: "disconnect" });
  });

  test("serializes opening offer body", () => {
    const wire = negotiationOutputToWire({
      raw: { expose: [{ kind: "slot", promise: "pick" }] },
      opening: true,
      peerPorts: [],
    });
    expect(wire.kind).toBe("offer");
    if (wire.kind !== "offer") throw new Error("expected offer");
    expect(wire.body).toMatchObject({
      offer: { type: "service.slot" },
      ports: [{ kind: "slot", promise: "pick" }],
    });
  });
});
