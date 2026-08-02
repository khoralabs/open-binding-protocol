import type { JsonDocument, Offer, Party, Port } from "@khoralabs/obp-core";
import { ObpError } from "@khoralabs/obp-core";
import { assertCanonicalBindCapacity, normalizeMaxBindings } from "./bind-capacity";
import { resolveCanonicalPortId } from "./canonical-port-ref";
import { ObpPersistenceClient } from "./persistence-client";
import type { ObpPersistenceStrategy } from "./persistence-strategy";
import type {
  BindListingRow,
  BindPortInput,
  BindPortOutput,
  BindPortTxnSnapshot,
  ExposedPortEdge,
  ExposePortInput,
  ExposePortOutput,
  ExtendOfferInput,
  ExtendOfferOutput,
  GetExtendingPartyIdInput,
  GetExtendingPartyIdOutput,
  GetNbcBindWindowForOfferInput,
  GetNbcBindWindowForOfferOutput,
  GetNbcBindWindowForPortInput,
  GetNbcBindWindowForPortOutput,
  GetOfferInput,
  GetOfferOutput,
  GetPartyInput,
  GetPartyOutput,
  GetPortBindPolicyInput,
  GetPortBindPolicyOutput,
  GetPortExposePolicyInput,
  GetPortExposePolicyOutput,
  GetPortInput,
  GetPortOutput,
  GetPortsSnapshotInput,
  GetPortsSnapshotOutput,
  IsPortExposedInput,
  IsPortExposedOutput,
  ListBindsInput,
  ListBindsOutput,
  ListExposedPortEdgesInput,
  ListExposedPortEdgesOutput,
  ObpPortExposePolicy,
  RegisterPartyInput,
  RegisterPartyOutput,
  SetOfferExpiredNowInput,
  SetOfferExpiredNowOutput,
  SetPortExpiredNowInput,
  SetPortExpiredNowOutput,
} from "./persistence-types";

/** Optional expose-time bind_policy check (NBC supplies AJV validator). */
export type ValidateBindPolicyAtExpose = (bindPolicy: JsonDocument | null) => void;

/** Minimal in-memory {@link ObpPersistenceStrategy} for tests and local daemons. */
export class InMemoryObpPersistenceStrategy implements ObpPersistenceStrategy {
  private parties = new Map<string, Party>();
  private offers = new Map<string, Offer>();
  private ports = new Map<string, Port>();
  private offerNbc = new Map<string, { nbc_expires_turn: number; nbc_expires_at_ms: number }>();
  private portNbc = new Map<string, { nbc_expires_turn: number; nbc_expires_at_ms: number }>();
  private extends = new Map<string, string>();
  private exposes: ExposedPortEdge[] = [];
  /** NBC expose-time bind_policy snapshot per port id (`null` when inactive). */
  private portBindPolicies = new Map<string, JsonDocument>();
  private portExposePolicies = new Map<string, ObpPortExposePolicy>();
  private binds: BindListingRow[] = [];
  private seq = 0n;

  constructor(private readonly validateBindPolicyAtExpose: ValidateBindPolicyAtExpose = () => {}) {}

  private nextId(): string {
    return `id-${++this.seq}`;
  }

  private assertNoDuplicateBind(offerId: string, portId: string): void {
    if (this.binds.some((b) => b.offerId === offerId && b.portId === portId)) {
      throw new ObpError("VALIDATION", `Duplicate bind for offer ${offerId} and port ${portId}`);
    }
  }

  private loadMaxBindingsMap(): Map<string, number> {
    const m = new Map<string, number>();
    for (const [portId, policy] of this.portExposePolicies) {
      m.set(portId, policy.max_bindings);
    }
    return m;
  }

  async registerParty(input: RegisterPartyInput): Promise<RegisterPartyOutput> {
    const id = input.id?.trim() ? input.id : this.nextId();
    const existing = this.parties.get(id);
    if (existing !== undefined) return { party: existing };
    const party: Party = { id, name: input.name };
    this.parties.set(party.id, party);
    return { party };
  }

  async getParty(input: GetPartyInput): Promise<GetPartyOutput> {
    const party = this.parties.get(input.id);
    return { result: party ? { kind: "party", party } : { kind: "notFound" } };
  }

  async getOffer(input: GetOfferInput): Promise<GetOfferOutput> {
    const offer = this.offers.get(input.id);
    return { result: offer ? { kind: "offer", offer } : { kind: "notFound" } };
  }

  async getPort(input: GetPortInput): Promise<GetPortOutput> {
    const port = this.ports.get(input.id);
    return { result: port ? { kind: "port", port } : { kind: "notFound" } };
  }

  async getPortBindPolicy(input: GetPortBindPolicyInput): Promise<GetPortBindPolicyOutput> {
    if (!this.ports.has(input.portId)) return { result: { kind: "notFound" } };
    return {
      result: {
        kind: "found",
        bind_policy: this.portBindPolicies.get(input.portId) ?? null,
      },
    };
  }

  async getPortExposePolicy(input: GetPortExposePolicyInput): Promise<GetPortExposePolicyOutput> {
    const policy = this.portExposePolicies.get(input.portId);
    if (!policy) return { result: { kind: "notFound" } };
    return { result: { kind: "found", policy } };
  }

  async extendOffer(input: ExtendOfferInput): Promise<ExtendOfferOutput> {
    const offer: Offer = { ...input.offer, id: this.nextId() };
    this.offers.set(offer.id, offer);
    this.extends.set(offer.id, input.partyId);
    const nt = input.nbc_expires_turn ?? 0;
    this.offerNbc.set(offer.id, {
      nbc_expires_turn: nt,
      nbc_expires_at_ms: input.nbc_expires_at_ms ?? 0,
    });
    const bindPortId = input.bindPortId.trim();
    if (bindPortId !== "") {
      assertCanonicalBindCapacity({
        targetPortId: bindPortId,
        portsById: this.ports,
        maxBindingsByPortId: this.loadMaxBindingsMap(),
        binds: this.binds,
      });
      this.assertNoDuplicateBind(offer.id, bindPortId);
      this.binds.push({
        offerId: offer.id,
        portId: bindPortId,
        bind_payload: input.bind_payload,
      });
    }
    return { offer };
  }

  async exposePort(input: ExposePortInput): Promise<ExposePortOutput> {
    if (!this.offers.has(input.offerId)) {
      throw new ObpError("NOT_FOUND", `Offer not found: ${input.offerId}`);
    }

    const portId = input.port.id.trim() !== "" ? input.port.id : this.nextId();
    const port: Port = { ...input.port, id: portId };
    const existing = this.ports.get(portId);

    if (existing) {
      this.exposes.push({ offerId: input.offerId, portId });
      return { port: existing };
    }

    this.validateBindPolicyAtExpose(input.bind_policy ?? null);

    const map = new Map(this.ports);
    map.set(port.id, port);
    const refTrim = port.ref.trim();
    if (refTrim !== "" && !map.has(refTrim)) {
      throw new ObpError("REF_MISSING", `Port ref target not found: ${refTrim}`);
    }
    const resolved = resolveCanonicalPortId(map, port.id);
    if (!resolved.ok) {
      if (resolved.reason === "cycle") {
        throw new ObpError("REF_CYCLE", `Port ref cycle: ${resolved.path.join(" -> ")}`);
      }
      throw new ObpError("REF_MISSING", `Missing port in ref chain: ${resolved.missingId}`);
    }

    this.ports.set(port.id, port);
    this.portBindPolicies.set(port.id, input.bind_policy ?? null);
    this.portExposePolicies.set(port.id, {
      max_bindings: normalizeMaxBindings(input.max_bindings),
      terminal: input.terminal ?? false,
      ttl_basis: input.ttl_basis ?? null,
      ttl_measure: input.ttl_measure ?? null,
      expose_seq: input.expose_seq ?? null,
    });
    this.exposes.push({ offerId: input.offerId, portId: port.id });
    const nt = input.nbc_expires_turn ?? 0;
    this.portNbc.set(port.id, {
      nbc_expires_turn: nt,
      nbc_expires_at_ms: input.nbc_expires_at_ms ?? 0,
    });
    return { port };
  }

  private buildBindPortTxnSnapshot(): BindPortTxnSnapshot {
    const offerNbcById = new Map(this.offerNbc);
    const portNbcById = new Map(this.portNbc);
    const portExposePolicyById = new Map(this.portExposePolicies);
    const exposedPortIds = new Set(this.exposes.map((e) => e.portId));
    return {
      portsById: this.ports,
      binds: this.binds,
      exposedPortIds,
      offerNbcById,
      portNbcById,
      portExposePolicyById,
    };
  }

  async bindPort(input: BindPortInput): Promise<BindPortOutput> {
    this.assertNoDuplicateBind(input.offerId, input.portId);
    if (input.assertAdmissible) {
      input.assertAdmissible(this.buildBindPortTxnSnapshot());
    } else {
      assertCanonicalBindCapacity({
        targetPortId: input.portId,
        portsById: this.ports,
        maxBindingsByPortId: this.loadMaxBindingsMap(),
        binds: this.binds,
      });
    }
    this.binds.push({
      offerId: input.offerId,
      portId: input.portId,
      bind_payload: input.bind_payload,
    });
    return {};
  }

  async listExposedPortEdges(
    _input: ListExposedPortEdgesInput,
  ): Promise<ListExposedPortEdgesOutput> {
    return { edges: [...this.exposes] };
  }

  async isPortExposed(input: IsPortExposedInput): Promise<IsPortExposedOutput> {
    return {
      exposed: this.exposes.some((e) => e.portId === input.portId),
    };
  }

  async listBinds(_input: ListBindsInput): Promise<ListBindsOutput> {
    return { binds: [...this.binds] };
  }

  async getPortsSnapshot(_input: GetPortsSnapshotInput): Promise<GetPortsSnapshotOutput> {
    const entries = [...this.ports.entries()].map(([portId, port]) => ({
      portId,
      port,
    }));
    return { entries };
  }

  async getExtendingPartyId(input: GetExtendingPartyIdInput): Promise<GetExtendingPartyIdOutput> {
    return { partyId: this.extends.get(input.offerId) ?? "" };
  }

  async getNbcBindWindowForOffer(
    input: GetNbcBindWindowForOfferInput,
  ): Promise<GetNbcBindWindowForOfferOutput> {
    if (!this.offers.has(input.offerId)) return { result: { kind: "notFound" } };
    const w = this.offerNbc.get(input.offerId) ?? {
      nbc_expires_turn: 0,
      nbc_expires_at_ms: 0,
    };
    return { result: { kind: "window", window: w } };
  }

  async getNbcBindWindowForPort(
    input: GetNbcBindWindowForPortInput,
  ): Promise<GetNbcBindWindowForPortOutput> {
    if (!this.ports.has(input.portId)) return { result: { kind: "notFound" } };
    const w = this.portNbc.get(input.portId) ?? {
      nbc_expires_turn: 0,
      nbc_expires_at_ms: 0,
    };
    return { result: { kind: "window", window: w } };
  }

  async setPortExpiredNow(input: SetPortExpiredNowInput): Promise<SetPortExpiredNowOutput> {
    const port = this.ports.get(input.portId);
    if (!port) return {};
    this.portNbc.set(input.portId, {
      nbc_expires_turn: 0,
      nbc_expires_at_ms: 1,
    });
    return {};
  }

  async setOfferExpiredNow(input: SetOfferExpiredNowInput): Promise<SetOfferExpiredNowOutput> {
    const offer = this.offers.get(input.offerId);
    if (offer) {
      this.offerNbc.set(input.offerId, {
        nbc_expires_turn: 0,
        nbc_expires_at_ms: 1,
      });
    }
    for (const edge of this.exposes) {
      if (edge.offerId !== input.offerId) continue;
      if (this.ports.has(edge.portId)) {
        this.portNbc.set(edge.portId, {
          nbc_expires_turn: 0,
          nbc_expires_at_ms: 1,
        });
      }
    }
    return {};
  }
}

export function createInMemoryObpPersistenceClient(options?: {
  validateBindPolicyAtExpose?: ValidateBindPolicyAtExpose;
}): ObpPersistenceClient {
  return new ObpPersistenceClient(
    new InMemoryObpPersistenceStrategy(options?.validateBindPolicyAtExpose),
  );
}
