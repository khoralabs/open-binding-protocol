import type { Database, Statement } from "bun:sqlite";
import { validateBindPolicyAtExpose } from "@khoralabs/nbc-bind-policy";
import { ObpError } from "@khoralabs/obp-errors";
import type { JsonDocument, Offer, Party, Port } from "@khoralabs/obp-model";
import type {
  BindPortInput,
  BindPortOutput,
  BindPortTxnSnapshot,
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
  ObpPersistenceStrategy,
  RegisterPartyInput,
  RegisterPartyOutput,
  SetOfferExpiredNowInput,
  SetOfferExpiredNowOutput,
  SetPortExpiredNowInput,
  SetPortExpiredNowOutput,
} from "@khoralabs/obp-persistence";
import {
  assertCanonicalBindCapacity,
  normalizeMaxBindings,
  resolveCanonicalPortId,
} from "@khoralabs/obp-persistence";

type PartyRow = {
  id: string;
  created_seq: number;
  name: string;
};

type OfferRow = {
  id: string;
  created_seq: number;
  nbc_expires_turn: number;
  nbc_expires_at_ms: number;
  type: string;
};

type PortRow = {
  id: string;
  created_seq: number;
  nbc_expires_turn: number;
  nbc_expires_at_ms: number;
  type: string;
  promise: string | null;
  max_bindings: number;
  terminal: number;
  ref: string;
  ttl_basis: string | null;
  ttl_measure: number | null;
  expose_seq: number | null;
  bind_policy_json: string | null;
};

function rowToParty(r: PartyRow): Party {
  return {
    id: r.id,
    name: r.name,
  };
}

function rowToOffer(r: OfferRow): Offer {
  return {
    id: r.id,
    type: r.type,
  };
}

function rowToPort(r: PortRow): Port {
  return {
    id: r.id,
    type: r.type,
    promise: r.promise ?? "",
    ref: r.ref ?? "",
  };
}

function rowToExposePolicy(r: PortRow) {
  return {
    max_bindings: r.max_bindings,
    terminal: r.terminal === 1,
    ttl_basis: r.ttl_basis,
    ttl_measure: r.ttl_measure,
    expose_seq: r.expose_seq,
  };
}

function stringifyCounterpartyBind(payload: JsonDocument): string | null {
  if (payload === null) return null;
  return JSON.stringify(payload);
}

function parseJsonDocument(raw: string | null): JsonDocument {
  if (raw === null || raw === "") return null;
  try {
    return JSON.parse(raw) as JsonDocument;
  } catch {
    return null;
  }
}

export class SqliteObpPersistenceStrategy implements ObpPersistenceStrategy {
  private readonly insertParty: Statement;
  private readonly updatePortExpiresNow: Statement;
  private readonly updateOfferExpiresNow: Statement;
  private readonly updatePortsExpiresNowForOffer: Statement;
  private readonly insertOffer: Statement;
  private readonly insertExtend: Statement;
  private readonly insertBind: Statement;
  private readonly insertPort: Statement;
  private readonly insertExpose: Statement;

  constructor(private readonly db: Database) {
    this.insertParty = db.prepare(
      `INSERT OR IGNORE INTO obp_parties (id, created_seq, name) VALUES (?, ?, ?)`,
    );
    this.updatePortExpiresNow = db.prepare(
      `UPDATE obp_ports SET nbc_expires_turn = ?, nbc_expires_at_ms = ? WHERE id = ?`,
    );
    this.updateOfferExpiresNow = db.prepare(
      `UPDATE obp_offers SET nbc_expires_turn = ?, nbc_expires_at_ms = ? WHERE id = ?`,
    );
    this.updatePortsExpiresNowForOffer = db.prepare(
      `UPDATE obp_ports SET nbc_expires_turn = ?, nbc_expires_at_ms = ? WHERE id IN (SELECT port_id FROM obp_exposes WHERE offer_id = ?)`,
    );
    this.insertOffer = db.prepare(
      `INSERT INTO obp_offers (id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type) VALUES (?, ?, ?, ?, ?)`,
    );
    this.insertExtend = db.prepare(
      `INSERT INTO obp_extends (edge_id, party_id, offer_id, created_seq) VALUES (?, ?, ?, ?)`,
    );
    this.insertBind = db.prepare(
      `INSERT INTO obp_binds (edge_id, offer_id, port_id, created_seq, counterparty_bind_json) VALUES (?, ?, ?, ?, ?)`,
    );
    this.insertPort = db.prepare(
      `INSERT INTO obp_ports (id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type, promise, max_bindings, terminal, ref, ttl_basis, ttl_measure, expose_seq, bind_policy_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.insertExpose = db.prepare(
      `INSERT INTO obp_exposes (edge_id, offer_id, port_id, created_seq) VALUES (?, ?, ?, ?)`,
    );
  }

  async registerParty(input: RegisterPartyInput): Promise<RegisterPartyOutput> {
    return this.db.transaction(() => {
      const id = input.id?.trim() !== "" ? (input.id ?? crypto.randomUUID()) : crypto.randomUUID();
      const seq = Date.now();
      this.insertParty.run(id, seq, input.name);
      return {
        party: rowToParty({
          id,
          created_seq: seq,
          name: input.name,
        }),
      };
    })();
  }

  async getParty(input: GetPartyInput): Promise<GetPartyOutput> {
    const row = this.db
      .query<PartyRow, [string]>(`SELECT id, created_seq, name FROM obp_parties WHERE id = ?`)
      .get(input.id);
    if (!row) return { result: { kind: "notFound" } };
    return { result: { kind: "party", party: rowToParty(row) } };
  }

  async getOffer(input: GetOfferInput): Promise<GetOfferOutput> {
    const row = this.db
      .query<OfferRow, [string]>(
        `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type FROM obp_offers WHERE id = ?`,
      )
      .get(input.id);
    if (!row) return { result: { kind: "notFound" } };
    return { result: { kind: "offer", offer: rowToOffer(row) } };
  }

  async getPort(input: GetPortInput): Promise<GetPortOutput> {
    const row = this.db
      .query<PortRow, [string]>(
        `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type, promise, max_bindings, terminal, ref, ttl_basis, ttl_measure, expose_seq, bind_policy_json FROM obp_ports WHERE id = ?`,
      )
      .get(input.id);
    if (!row) return { result: { kind: "notFound" } };
    return { result: { kind: "port", port: rowToPort(row) } };
  }

  async getPortBindPolicy(input: GetPortBindPolicyInput): Promise<GetPortBindPolicyOutput> {
    const row = this.db
      .query<{ bind_policy_json: string | null }, [string]>(
        `SELECT bind_policy_json FROM obp_ports WHERE id = ?`,
      )
      .get(input.portId);
    if (!row) return { result: { kind: "notFound" } };
    return {
      result: {
        kind: "found",
        bind_policy: parseJsonDocument(row.bind_policy_json),
      },
    };
  }

  async getPortExposePolicy(input: GetPortExposePolicyInput): Promise<GetPortExposePolicyOutput> {
    const row = this.db
      .query<PortRow, [string]>(
        `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type, promise, max_bindings, terminal, ref, ttl_basis, ttl_measure, expose_seq, bind_policy_json FROM obp_ports WHERE id = ?`,
      )
      .get(input.portId);
    if (!row) return { result: { kind: "notFound" } };
    return {
      result: {
        kind: "found",
        policy: rowToExposePolicy(row),
      },
    };
  }

  async extendOffer(input: ExtendOfferInput): Promise<ExtendOfferOutput> {
    return this.db.transaction(() => {
      const partyExists = this.db
        .query<{ one: number }, [string]>(`SELECT 1 AS one FROM obp_parties WHERE id = ?`)
        .get(input.partyId);
      if (!partyExists) {
        throw new ObpError("NOT_FOUND", `Party not found: ${input.partyId}`);
      }

      const offerId = input.offer.id.trim() !== "" ? input.offer.id : crypto.randomUUID();
      const seq = Date.now();
      const offer: Offer = {
        ...input.offer,
        id: offerId,
      };
      const nbcT = input.nbc_expires_turn ?? 0;
      const nbcA = input.nbc_expires_at_ms ?? 0;
      this.insertOffer.run(offer.id, seq, nbcT, nbcA, offer.type);

      const extId = crypto.randomUUID();
      this.insertExtend.run(extId, input.partyId, offer.id, seq);

      const bindPortId = input.bindPortId.trim();
      if (bindPortId !== "") {
        const portRow = this.db
          .query<PortRow, [string]>(
            `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type, promise, max_bindings, terminal, ref, ttl_basis, ttl_measure, expose_seq, bind_policy_json FROM obp_ports WHERE id = ?`,
          )
          .get(bindPortId);
        if (!portRow) {
          throw new ObpError("NOT_FOUND", `Port not found: ${bindPortId}`);
        }
        this.assertBindCapacityInTxn(bindPortId);
        const bindEdge = crypto.randomUUID();
        const cbJson = stringifyCounterpartyBind(input.bind_payload);
        this.insertBind.run(bindEdge, offer.id, bindPortId, seq, cbJson);
      }

      return { offer };
    })();
  }

  async exposePort(input: ExposePortInput): Promise<ExposePortOutput> {
    return this.db.transaction(() => {
      const offerExists = this.db
        .query<{ one: number }, [string]>(`SELECT 1 AS one FROM obp_offers WHERE id = ?`)
        .get(input.offerId);
      if (!offerExists) {
        throw new ObpError("NOT_FOUND", `Offer not found: ${input.offerId}`);
      }

      const portId = input.port.id.trim() !== "" ? input.port.id : crypto.randomUUID();
      const seq = Date.now();
      const port: Port = {
        ...input.port,
        id: portId,
      };

      const existingRow = this.db
        .query<PortRow, [string]>(
          `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type, promise, max_bindings, terminal, ref, ttl_basis, ttl_measure, expose_seq, bind_policy_json FROM obp_ports WHERE id = ?`,
        )
        .get(portId);

      if (existingRow) {
        const exId = crypto.randomUUID();
        this.insertExpose.run(exId, input.offerId, portId, seq);
        return { port: rowToPort(existingRow) };
      }

      validateBindPolicyAtExpose(input.bind_policy ?? null);

      const map = this.loadPortsMap();
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

      const nbcT = input.nbc_expires_turn ?? 0;
      const nbcA = input.nbc_expires_at_ms ?? 0;
      const bindPolicyJson = stringifyCounterpartyBind(input.bind_policy ?? null);
      const maxBindings = normalizeMaxBindings(input.max_bindings);
      const terminal = (input.terminal ?? false) ? 1 : 0;
      this.insertPort.run(
        port.id,
        seq,
        nbcT,
        nbcA,
        port.type,
        port.promise,
        maxBindings,
        terminal,
        port.ref,
        input.ttl_basis ?? null,
        input.ttl_measure ?? null,
        input.expose_seq ?? null,
        bindPolicyJson,
      );

      const exId = crypto.randomUUID();
      this.insertExpose.run(exId, input.offerId, port.id, seq);

      return { port };
    })();
  }

  async bindPort(input: BindPortInput): Promise<BindPortOutput> {
    return this.db.transaction(() => {
      const offerRes = this.db
        .query<OfferRow, [string]>(
          `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type FROM obp_offers WHERE id = ?`,
        )
        .get(input.offerId);
      if (!offerRes) {
        throw new ObpError("NOT_FOUND", `Offer not found: ${input.offerId}`);
      }

      const portRow = this.db
        .query<PortRow, [string]>(
          `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type, promise, max_bindings, terminal, ref, ttl_basis, ttl_measure, expose_seq, bind_policy_json FROM obp_ports WHERE id = ?`,
        )
        .get(input.portId);
      if (!portRow) {
        throw new ObpError("NOT_FOUND", `Port not found: ${input.portId}`);
      }

      if (input.assertAdmissible) {
        input.assertAdmissible(this.buildBindPortTxnSnapshot());
      } else {
        this.assertBindCapacityInTxn(input.portId);
      }

      const seq = Date.now();
      const bindEdge = crypto.randomUUID();
      const cbJson = stringifyCounterpartyBind(input.bind_payload);
      try {
        this.insertBind.run(bindEdge, input.offerId, input.portId, seq, cbJson);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE") || msg.includes("unique")) {
          throw new ObpError(
            "VALIDATION",
            `Duplicate bind for offer ${input.offerId} and port ${input.portId}`,
          );
        }
        throw e;
      }
      return {};
    })();
  }

  async listExposedPortEdges(
    _input: ListExposedPortEdgesInput,
  ): Promise<ListExposedPortEdgesOutput> {
    const rows = this.db
      .query<{ offer_id: string; port_id: string }, []>(`SELECT offer_id, port_id FROM obp_exposes`)
      .all();
    return {
      edges: rows.map((r) => ({ offerId: r.offer_id, portId: r.port_id })),
    };
  }

  async isPortExposed(input: IsPortExposedInput): Promise<IsPortExposedOutput> {
    const row = this.db
      .query<{ one: number }, [string]>(
        `SELECT 1 AS one FROM obp_exposes WHERE port_id = ? LIMIT 1`,
      )
      .get(input.portId);
    return { exposed: row !== null };
  }

  async listBinds(_input: ListBindsInput): Promise<ListBindsOutput> {
    const rows = this.db
      .query<
        {
          offer_id: string;
          port_id: string;
          counterparty_bind_json: string | null;
        },
        []
      >(`SELECT offer_id, port_id, counterparty_bind_json FROM obp_binds`)
      .all();
    return {
      binds: rows.map((r) => ({
        offerId: r.offer_id,
        portId: r.port_id,
        bind_payload: parseJsonDocument(r.counterparty_bind_json),
      })),
    };
  }

  async getPortsSnapshot(_input: GetPortsSnapshotInput): Promise<GetPortsSnapshotOutput> {
    const entries = [...this.loadPortsMap().entries()].map(([portId, port]) => ({ portId, port }));
    return { entries };
  }

  async getExtendingPartyId(input: GetExtendingPartyIdInput): Promise<GetExtendingPartyIdOutput> {
    const row = this.db
      .query<{ party_id: string }, [string]>(`SELECT party_id FROM obp_extends WHERE offer_id = ?`)
      .get(input.offerId);
    return { partyId: row?.party_id ?? "" };
  }

  async getNbcBindWindowForOffer(
    input: GetNbcBindWindowForOfferInput,
  ): Promise<GetNbcBindWindowForOfferOutput> {
    const row = this.db
      .query<{ nbc_expires_turn: number; nbc_expires_at_ms: number }, [string]>(
        `SELECT nbc_expires_turn, nbc_expires_at_ms FROM obp_offers WHERE id = ?`,
      )
      .get(input.offerId);
    if (!row) return { result: { kind: "notFound" } };
    return {
      result: {
        kind: "window",
        window: {
          nbc_expires_turn: row.nbc_expires_turn,
          nbc_expires_at_ms: row.nbc_expires_at_ms,
        },
      },
    };
  }

  async getNbcBindWindowForPort(
    input: GetNbcBindWindowForPortInput,
  ): Promise<GetNbcBindWindowForPortOutput> {
    const row = this.db
      .query<{ nbc_expires_turn: number; nbc_expires_at_ms: number }, [string]>(
        `SELECT nbc_expires_turn, nbc_expires_at_ms FROM obp_ports WHERE id = ?`,
      )
      .get(input.portId);
    if (!row) return { result: { kind: "notFound" } };
    return {
      result: {
        kind: "window",
        window: {
          nbc_expires_turn: row.nbc_expires_turn,
          nbc_expires_at_ms: row.nbc_expires_at_ms,
        },
      },
    };
  }

  async setPortExpiredNow(input: SetPortExpiredNowInput): Promise<SetPortExpiredNowOutput> {
    const row = this.db
      .query<{ one: number }, [string]>(`SELECT 1 AS one FROM obp_ports WHERE id = ?`)
      .get(input.portId);
    if (!row) {
      throw new ObpError("NOT_FOUND", `Port not found: ${input.portId}`);
    }
    this.updatePortExpiresNow.run(0, 1, input.portId);
    return {};
  }

  async setOfferExpiredNow(input: SetOfferExpiredNowInput): Promise<SetOfferExpiredNowOutput> {
    const row = this.db
      .query<{ one: number }, [string]>(`SELECT 1 AS one FROM obp_offers WHERE id = ?`)
      .get(input.offerId);
    if (!row) {
      throw new ObpError("NOT_FOUND", `Offer not found: ${input.offerId}`);
    }
    this.db.transaction(() => {
      this.updateOfferExpiresNow.run(0, 1, input.offerId);
      this.updatePortsExpiresNowForOffer.run(0, 1, input.offerId);
    })();
    return {};
  }

  private buildBindPortTxnSnapshot(): BindPortTxnSnapshot {
    const portsById = this.loadPortsMap();
    const binds = this.listBindsInTxn();
    const exposeRows = this.db
      .query<{ port_id: string }, []>(`SELECT DISTINCT port_id FROM obp_exposes`)
      .all();
    const exposedPortIds = new Set(exposeRows.map((r) => r.port_id));

    const offerRows = this.db
      .query<{ id: string; nbc_expires_turn: number; nbc_expires_at_ms: number }, []>(
        `SELECT id, nbc_expires_turn, nbc_expires_at_ms FROM obp_offers`,
      )
      .all();
    const offerNbcById = new Map(
      offerRows.map((r) => [
        r.id,
        {
          nbc_expires_turn: r.nbc_expires_turn,
          nbc_expires_at_ms: r.nbc_expires_at_ms,
        },
      ]),
    );

    const portRows = this.db
      .query<
        {
          id: string;
          nbc_expires_turn: number;
          nbc_expires_at_ms: number;
          max_bindings: number;
          terminal: number;
          ttl_basis: string | null;
          ttl_measure: number | null;
          expose_seq: number | null;
        },
        []
      >(
        `SELECT id, nbc_expires_turn, nbc_expires_at_ms, max_bindings, terminal, ttl_basis, ttl_measure, expose_seq FROM obp_ports`,
      )
      .all();
    const portNbcById = new Map(
      portRows.map((r) => [
        r.id,
        {
          nbc_expires_turn: r.nbc_expires_turn,
          nbc_expires_at_ms: r.nbc_expires_at_ms,
        },
      ]),
    );
    const portExposePolicyById = new Map(
      portRows.map((r) => [
        r.id,
        {
          max_bindings: r.max_bindings,
          terminal: r.terminal === 1,
          ttl_basis: r.ttl_basis,
          ttl_measure: r.ttl_measure,
          expose_seq: r.expose_seq,
        },
      ]),
    );

    return {
      portsById,
      binds,
      exposedPortIds,
      offerNbcById,
      portNbcById,
      portExposePolicyById,
    };
  }

  private assertBindCapacityInTxn(targetPortId: string): void {
    const portsById = this.loadPortsMap();
    const maxBindingsByPortId = this.loadMaxBindingsMap();
    const binds = this.listBindsInTxn();
    assertCanonicalBindCapacity({
      targetPortId,
      portsById,
      maxBindingsByPortId,
      binds,
    });
  }

  private listBindsInTxn(): { offerId: string; portId: string }[] {
    const rows = this.db
      .query<{ offer_id: string; port_id: string }, []>(`SELECT offer_id, port_id FROM obp_binds`)
      .all();
    return rows.map((r) => ({ offerId: r.offer_id, portId: r.port_id }));
  }

  private loadMaxBindingsMap(): Map<string, number> {
    const rows = this.db
      .query<{ id: string; max_bindings: number }, []>(`SELECT id, max_bindings FROM obp_ports`)
      .all();
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.id, r.max_bindings);
    }
    return m;
  }

  private loadPortsMap(): Map<string, Port> {
    const rows = this.db
      .query<PortRow, []>(
        `SELECT id, created_seq, nbc_expires_turn, nbc_expires_at_ms, type, promise, max_bindings, terminal, ref, ttl_basis, ttl_measure, expose_seq, bind_policy_json FROM obp_ports`,
      )
      .all();
    const m = new Map<string, Port>();
    for (const r of rows) {
      m.set(r.id, rowToPort(r));
    }
    return m;
  }
}

export function createObpSqliteStrategy(db: Database): SqliteObpPersistenceStrategy {
  return new SqliteObpPersistenceStrategy(db);
}
