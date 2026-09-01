/**
 * Host overlay on OBP {@link whoShouldAct} / {@link availablePortsFor}.
 */

import { availablePortsFor, whoShouldAct as obpWhoShouldAct } from "../nbc-acting-party.ts";
import type { NbcChainGraph } from "../nbc-chain-graph-types.ts";

export const NBC_DEFAULT_MAX_TURNS = 6;
export const NBC_MAX_TURNS_CAP = 10;

export type NegotiationChainView = {
  status: string;
  initiatorDid: string;
  counterpartyDid: string;
  turnsCompleted: number;
  maxTurns: number;
  negotiationOutcome?: string | null;
};

export type WhoShouldActResult = {
  did: string | null;
  reason:
    | "initiator-open"
    | "alternate"
    | "terminal-bind"
    | "left"
    | "turn-limit"
    | "not-open"
    | "error";
};

export function whoShouldActWithChainState(
  graph: NbcChainGraph,
  chain: NegotiationChainView,
): WhoShouldActResult {
  if (chain.status !== "open") {
    return { did: null, reason: "not-open" };
  }
  if (chain.negotiationOutcome === "left") {
    return { did: null, reason: "left" };
  }
  if (chain.negotiationOutcome === "error") {
    return { did: null, reason: "error" };
  }
  if (chain.negotiationOutcome === "bound" || graph.binds.length > 0) {
    return { did: null, reason: "terminal-bind" };
  }
  if (chain.negotiationOutcome === "turn-limit" || chain.turnsCompleted >= chain.maxTurns) {
    return { did: null, reason: "turn-limit" };
  }
  const did = obpWhoShouldAct(graph, { initiatorId: chain.initiatorDid });
  if (did === null) {
    // No bind and no negotiationOutcome "bound": null means missing counterparty
    // or no bindable ports — not a terminal bind.
    return { did: null, reason: "error" };
  }
  return {
    did,
    reason: graph.offers.length === 0 ? "initiator-open" : "alternate",
  };
}

export type AvailablePeerPort = {
  id: string;
  type: string;
  promise: string;
  partyId: string;
  bind_policy: Record<string, unknown> | null;
};

function jsonObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function availablePeerPorts(graph: NbcChainGraph, asDid: string): AvailablePeerPort[] {
  return availablePortsFor(asDid, graph).map((port) => {
    const offerId = port.exposedOnOfferIds[0];
    const partyId = graph.offers.find((o) => o.id === offerId)?.partyId ?? "";
    return {
      id: port.id,
      type: port.kind,
      promise: port.promise,
      partyId,
      bind_policy: jsonObjectOrNull(port.bind_policy),
    };
  });
}

export function clampMaxTurns(raw: unknown, fallback = NBC_DEFAULT_MAX_TURNS): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  const n = Math.floor(raw);
  if (n < 1) return fallback;
  return Math.min(n, NBC_MAX_TURNS_CAP);
}
