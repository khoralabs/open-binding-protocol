import type { JsonDocument } from "@khoralabs/obp-core";
import {
  countBindsForCanonicalPort,
  type ObpPersistenceClient,
} from "@khoralabs/obp-core/persistence";
import type {
  NbcChainExposeEdge,
  NbcChainExtendEdge,
  NbcChainGraph,
  NbcChainOfferRow,
  NbcChainPartyRow,
  NbcChainPortRow,
} from "./nbc-chain-graph-types";
import {
  isActiveBindPolicy,
  isEpochExpiryOk,
  isTurnExpiryOk,
  type NbcBindTiming,
} from "./nbc-invariants";
import { resolveCanonicalPortId } from "./nbc-ref";

export type CollectNbcChainGraphOptions = {
  /** When set, **`expired`** flags use NBC N1 against this timing. */
  timing?: NbcBindTiming;
};

function isNbcExpiryViewExpired(
  node: { readonly expires_turn: number; readonly expires_at_ms: number },
  t: NbcBindTiming,
): boolean {
  return !(
    isTurnExpiryOk(node.expires_turn, t.turnSeq) &&
    isEpochExpiryOk(node.expires_at_ms, t.effectiveNowMs)
  );
}

export async function collectNbcChainGraph(
  client: ObpPersistenceClient,
  options: CollectNbcChainGraphOptions = {},
): Promise<NbcChainGraph> {
  const { timing } = options;

  const [{ edges: exposedEdges }, { binds }, snapOut] = await Promise.all([
    client.listExposedPortEdges(),
    client.listBinds(),
    client.getPortsSnapshot(),
  ]);

  const exposes: NbcChainExposeEdge[] = exposedEdges.map((e) => ({
    offerId: e.offerId,
    portId: e.portId,
  }));

  const offerIds = new Set<string>();
  for (const e of exposes) offerIds.add(e.offerId);
  for (const b of binds) offerIds.add(b.offerId);

  const extendRows = await Promise.all(
    [...offerIds].map(async (offerId) => {
      const partyId = await client.getExtendingPartyId(offerId);
      if (partyId === null || partyId === "") return null;
      return { partyId, offerId } satisfies NbcChainExtendEdge;
    }),
  );
  const extendsEdges = extendRows.filter((x): x is NbcChainExtendEdge => x !== null);
  const partyIds = new Set(extendsEdges.map((e) => e.partyId));

  const partyRows = await Promise.all(
    [...partyIds].map(async (id) => {
      const { result } = await client.getParty({ id });
      if (result.kind === "party") {
        return {
          id: result.party.id,
          name: result.party.name,
        } satisfies NbcChainPartyRow;
      }
      return { id, name: "—" } satisfies NbcChainPartyRow;
    }),
  );
  const parties = [...partyRows].sort((a, b) => a.id.localeCompare(b.id));

  const partyNameById = new Map(parties.map((p) => [p.id, p.name]));

  const offerRows = await Promise.all(
    [...offerIds].map(async (offerId) => {
      const { result } = await client.getOffer({ id: offerId });
      if (result.kind !== "offer") return null;
      const o = result.offer;
      const win = await client.getNbcBindWindowForOfferOrNull(offerId);
      const expires_turn = win?.nbc_expires_turn ?? 0;
      const expires_at_ms = win?.nbc_expires_at_ms ?? 0;
      const ext = extendsEdges.find((e) => e.offerId === offerId);
      const partyId = ext?.partyId ?? "";
      const partyName = partyId ? partyNameById.get(partyId) : undefined;
      const expiryView = { expires_turn, expires_at_ms };
      return {
        id: o.id,
        type: o.type,
        expires_turn,
        expires_at_ms,
        partyId,
        partyName,
        ...(timing !== undefined ? { expired: isNbcExpiryViewExpired(expiryView, timing) } : {}),
      } satisfies NbcChainOfferRow;
    }),
  );
  const offers: NbcChainOfferRow[] = offerRows.filter((row) => row !== null);
  offers.sort((a, b) => a.id.localeCompare(b.id));

  const portsById = new Map(snapOut.entries.map((e) => [e.portId, e.port]));

  const exposedByPort = new Map<string, string[]>();
  for (const e of exposes) {
    const list = exposedByPort.get(e.portId) ?? [];
    list.push(e.offerId);
    exposedByPort.set(e.portId, list);
  }
  for (const [, list] of exposedByPort) {
    list.sort((a, b) => a.localeCompare(b));
  }

  const ports: NbcChainPortRow[] = await Promise.all(
    snapOut.entries.map(async ({ portId, port }) => {
      let bind_policy: JsonDocument | undefined;
      const pr = await client.getPortBindPolicy({ portId });
      if (pr.result.kind === "found" && isActiveBindPolicy(pr.result.bind_policy)) {
        bind_policy = pr.result.bind_policy;
      }
      const win = await client.getNbcBindWindowForPortOrNull(portId);
      const expires_turn = win?.nbc_expires_turn ?? 0;
      const expires_at_ms = win?.nbc_expires_at_ms ?? 0;
      const expiryView = { expires_turn, expires_at_ms };
      const resolved = resolveCanonicalPortId(portsById, portId);
      const canonicalId = resolved.ok ? resolved.canonicalId : portId;
      const bindCount = countBindsForCanonicalPort(binds, portsById, canonicalId);
      const exposePolicyRes = await client.getPortExposePolicy({ portId: canonicalId });
      const row: NbcChainPortRow = {
        id: port.id,
        type: port.type,
        promise: port.promise,
        ref: port.ref,
        expires_turn,
        expires_at_ms,
        exposedOnOfferIds: Object.freeze([...(exposedByPort.get(portId) ?? [])]),
        bindCount,
        ...(timing !== undefined ? { expired: isNbcExpiryViewExpired(expiryView, timing) } : {}),
        bind_policy,
        ...(exposePolicyRes.result.kind === "found"
          ? {
              max_bindings: exposePolicyRes.result.policy.max_bindings,
              terminal: exposePolicyRes.result.policy.terminal,
            }
          : {}),
      };
      return row;
    }),
  );
  ports.sort((a, b) => a.id.localeCompare(b.id));

  return {
    parties,
    offers,
    ports,
    extends: extendsEdges,
    exposes,
    binds: binds.map((b) => ({
      offerId: b.offerId,
      portId: b.portId,
      bind_payload: b.bind_payload,
    })),
  };
}
