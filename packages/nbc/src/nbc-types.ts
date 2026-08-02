/**
 * TypeScript models for **`khora.obp.nbc`** turn payloads — see
 * `packages/nbc/spec/model/nbc-turn.smithy`.
 */

import type { JsonDocument, Port } from "@khoralabs/obp-core";
import type { ClockBlock, HlcTimestamp } from "./nbc-hlc";

/** Service version from `NbcNegotiationProtocol` in Smithy. */
export const NBC_NEGOTIATION_PROTOCOL_VERSION = "2026-05-14" as const;

/** Offer spec on an NBC TURN (bind-window + identity); maps ExtendOffer thin `offer` + NBC projection inputs. */
export type NbcOfferSpec = {
  id: string;
  type: string;
  expires_turn: number;
  expires_at_ms: number;
};

/** Affordance spec in an NBC TURN (maps to `ExposePort` + thin `khora.obp#Port`). */
export type NbcPortSpec = {
  id: string;
  type: string;
  promise: string;
  expires_turn: number;
  expires_at_ms: number;
  bind_policy: JsonDocument | null;
  ref: string;
  /** NBC N2 bind capacity; omitted on wire defaults to **1** at expose. */
  max_bindings?: number;
  /** NBC orchestration hint; omitted on wire defaults to **false**. */
  terminal?: boolean;
};

/** Canonical `Frame.body` for bilateral NBC TURN frames. */
export type NbcTurnBody = {
  offer: NbcOfferSpec;
  ports: readonly NbcPortSpec[];
  bind_port_id: string;
  bind_payload: JsonDocument | null;
  clock?: ClockBlock;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function toFiniteNumber(v: unknown, field: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v.trim());
  throw new TypeError(`${field}: expected finite number`);
}

function toNonnegInt(v: unknown, field: string): number {
  if (v === undefined || v === null) return 0;
  const n = toFiniteNumber(v, field);
  if (!Number.isInteger(n)) throw new TypeError(`${field}: expected integer`);
  if (n < 0) throw new TypeError(`${field}: expected non-negative integer`);
  return n;
}

function toEpochMs(v: unknown, field: string): number {
  if (v === undefined || v === null) return 0;
  const n = toFiniteNumber(v, field);
  if (!Number.isInteger(n)) throw new TypeError(`${field}: expected integer`);
  if (n < 0) throw new TypeError(`${field}: expected non-negative epoch ms`);
  return n;
}

function parseHlcTimestamp(v: unknown, field: string): HlcTimestamp {
  if (!isRecord(v)) throw new TypeError(`${field}: expected object`);
  const pt = toNonnegInt(v.pt, `${field}.pt`);
  const lc = toNonnegInt(v.lc, `${field}.lc`);
  return { pt, lc };
}

function parseClockBlock(v: unknown): ClockBlock | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isRecord(v)) throw new TypeError("clock: expected object");
  const hlc = parseHlcTimestamp(v.hlc, "clock.hlc");
  let observed: ClockBlock["observed"];
  if (v.observed !== undefined && v.observed !== null) {
    const o = v.observed;
    if (!isRecord(o)) throw new TypeError("clock.observed: expected object");
    if (
      typeof o.p_hash !== "string" ||
      typeof o.peer_actor !== "string" ||
      typeof o.peer_pt !== "number" ||
      typeof o.recv_ms !== "number"
    ) {
      throw new TypeError("clock.observed: invalid shape");
    }
    observed = {
      p_hash: o.p_hash,
      peer_actor: o.peer_actor,
      peer_pt: o.peer_pt,
      recv_ms: o.recv_ms,
    };
  }
  return { hlc, ...(observed !== undefined ? { observed } : {}) };
}

function parseNbcOfferSpec(v: unknown): NbcOfferSpec {
  if (!isRecord(v)) throw new TypeError("offer: expected object");
  const id = v.id;
  const type = v.type;
  if (typeof id !== "string") throw new TypeError("offer.id: expected string");
  if (typeof type !== "string") throw new TypeError("offer.type: expected string");
  const expires_turn = toNonnegInt(v.expires_turn, "offer.expires_turn");
  const expires_at_ms = toEpochMs(v.expires_at_ms, "offer.expires_at_ms");
  return { id, type, expires_turn, expires_at_ms };
}

function parseNbcPortSpec(v: unknown): NbcPortSpec {
  if (!isRecord(v)) throw new TypeError("port spec: expected object");
  const id = v.id;
  const type = v.type;
  if (typeof id !== "string") throw new TypeError("NbcPortSpec.id: expected string");
  if (typeof type !== "string") throw new TypeError("NbcPortSpec.type: expected string");
  const promise = typeof v.promise === "string" ? v.promise : "";
  const expires_turn = toNonnegInt(v.expires_turn, "NbcPortSpec.expires_turn");
  const expires_at_ms = toEpochMs(v.expires_at_ms, "NbcPortSpec.expires_at_ms");
  const ref = typeof v.ref === "string" ? v.ref : "";
  let bind_policy: JsonDocument | null = null;
  if ("bind_policy" in v) {
    const bp = v.bind_policy;
    if (bp === undefined || bp === null) bind_policy = null;
    else bind_policy = bp as JsonDocument;
  }
  let max_bindings: number | undefined;
  if ("max_bindings" in v && v.max_bindings !== undefined && v.max_bindings !== null) {
    max_bindings = toNonnegInt(v.max_bindings, "NbcPortSpec.max_bindings");
    if (max_bindings < 1) {
      throw new TypeError("NbcPortSpec.max_bindings: expected positive integer (>= 1)");
    }
  }
  let terminal: boolean | undefined;
  if ("terminal" in v && v.terminal !== undefined && v.terminal !== null) {
    terminal = Boolean(v.terminal);
  }
  return {
    id,
    type,
    promise,
    expires_turn,
    expires_at_ms,
    bind_policy,
    ref,
    ...(max_bindings !== undefined ? { max_bindings } : {}),
    ...(terminal !== undefined ? { terminal } : {}),
  };
}

/**
 * Runtime parse of `Frame.body` / `JsonDocument` into **`NbcTurnBody`**.
 * @throws TypeError on invalid shape
 */
export function parseNbcTurnBody(v: unknown): NbcTurnBody {
  if (!isRecord(v)) throw new TypeError("NbcTurnBody: expected object");

  const offer = parseNbcOfferSpec(v.offer);

  const portsRaw = v.ports;
  if (!Array.isArray(portsRaw)) throw new TypeError("ports: expected array");
  const ports = portsRaw.map(parseNbcPortSpec);

  const bind_port_id = typeof v.bind_port_id === "string" ? v.bind_port_id : "";

  let bind_payload: JsonDocument | null = null;
  if ("bind_payload" in v) {
    const bp = v.bind_payload;
    if (bp === undefined || bp === null) bind_payload = null;
    else bind_payload = bp as JsonDocument;
  }

  const clock = parseClockBlock(v.clock);

  return {
    offer,
    ports,
    bind_port_id,
    bind_payload,
    ...(clock !== undefined ? { clock } : {}),
  };
}

export function isNbcTurnBody(v: unknown): v is NbcTurnBody {
  try {
    parseNbcTurnBody(v);
    return true;
  } catch {
    return false;
  }
}

function epochMsForWire(n: number): number | string {
  return n <= Number.MAX_SAFE_INTEGER && n >= Number.MIN_SAFE_INTEGER ? n : String(n);
}

/** Canonical `Frame.body` JSON for outbound NBC TURN frames (`khora.obp.nbc#NbcTurnBody`). */
export function serializeNbcTurnBodyForWire(body: NbcTurnBody): Record<string, unknown> {
  return {
    offer: {
      id: body.offer.id,
      type: body.offer.type,
      expires_turn: body.offer.expires_turn,
      expires_at_ms: epochMsForWire(body.offer.expires_at_ms),
    },
    ports: body.ports.map((p) => ({
      id: p.id,
      type: p.type,
      promise: p.promise,
      expires_turn: p.expires_turn,
      expires_at_ms: epochMsForWire(p.expires_at_ms),
      bind_policy: p.bind_policy,
      ref: p.ref,
      ...(p.max_bindings !== undefined ? { max_bindings: p.max_bindings } : {}),
      ...(p.terminal !== undefined ? { terminal: p.terminal } : {}),
    })),
    bind_port_id: body.bind_port_id,
    bind_payload: body.bind_payload,
    ...(body.clock !== undefined ? { clock: body.clock } : {}),
  };
}

/** Map **`NbcPortSpec`** to a thin **`khora.obp#Port`** for `ExposePort` (drops `bind_policy`). */
export function nbcPortSpecToPort(spec: NbcPortSpec): Port {
  return {
    id: spec.id,
    type: spec.type,
    promise: spec.promise,
    ref: spec.ref,
  };
}
