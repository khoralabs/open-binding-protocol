/**
 * Bilateral ping-pong helpers over {@link NbcChainGraph}. Not NBC N1–N9.
 */

import type { NbcChainGraph, NbcChainPortRow } from "./nbc-chain-graph-types";
import { isEpochExpiryOk, isTurnExpiryOk, type NbcBindTiming } from "./nbc-invariants";

function offerPartyId(graph: NbcChainGraph, offerId: string): string | undefined {
  return graph.offers.find((o) => o.id === offerId)?.partyId;
}

function isPortExpired(p: NbcChainPortRow, timing?: NbcBindTiming): boolean {
  if (p.expired === true) return true;
  if (timing === undefined) return false;
  return !(
    isTurnExpiryOk(p.expires_turn, timing.turnSeq) &&
    isEpochExpiryOk(p.expires_at_ms, timing.effectiveNowMs)
  );
}

/**
 * Ports **`partyId`** can bind: exposed on a counterparty offer, not expired, under `max_bindings`.
 */
export function availablePortsFor(
  partyId: string,
  graph: NbcChainGraph,
  timing?: NbcBindTiming,
): NbcChainPortRow[] {
  return graph.ports.filter((p) => {
    const exposedByPeer = p.exposedOnOfferIds.some((oid) => {
      const owner = offerPartyId(graph, oid);
      return owner !== undefined && owner !== partyId;
    });
    if (!exposedByPeer) return false;
    if (isPortExpired(p, timing)) return false;
    const max = p.max_bindings ?? 1;
    return p.bindCount < max;
  });
}

/**
 * Bilateral acting party: empty graph → initiator; otherwise the party who did not extend
 * the last offer, if they still have bindable ports; otherwise `null` (natural stop).
 */
export function whoShouldAct(
  graph: NbcChainGraph,
  opts: { initiatorId: string },
  timing?: NbcBindTiming,
): string | null {
  if (graph.offers.length === 0) return opts.initiatorId;
  const last = graph.offers[graph.offers.length - 1];
  if (last === undefined) return opts.initiatorId;
  const next = graph.parties.find((p) => p.id !== last.partyId)?.id;
  if (next === undefined) return null;
  if (availablePortsFor(next, graph, timing).length === 0) return null;
  return next;
}
