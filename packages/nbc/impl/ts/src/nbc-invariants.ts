/**
 * Bilateral NBC bind-time checks: N1 (expiry), N2/N5 (`max_bindings` tally), N3 (ref chain), N4 (bind policy).
 * N6: `bindPort` accepts optional `assertAdmissible(snapshot)` run inside the store transaction before insert; `applyNbcTurn` uses this for atomic admission + bind.
 */

import { ObpError } from "@khoralabs/obp-errors";
import type { JsonDocument, Offer, Port } from "@khoralabs/obp-model";
import {
  type BindPortTxnSnapshot,
  countBindsForCanonicalPort,
  type ObpNbcBindWindow,
  type ObpPortExposePolicy,
} from "@khoralabs/obp-persistence";
import { resolveCanonicalPortId } from "./nbc-ref";

export type NbcBindFailure =
  | { code: "EXPIRED"; entity: "offer" | "port" }
  | { code: "NOT_EXPOSED" }
  | { code: "REF_CYCLE"; path: readonly string[] }
  | { code: "REF_MISSING"; missingId: string }
  | { code: "MAX_BINDINGS_EXCEEDED"; canonicalPortId: string; max_bindings: number }
  | { code: "POLICY_REJECTED"; reason: string };

export type NbcBindTiming = {
  /** DAG-committed frame count on this chain before applying the binding TURN. */
  turnSeq: number;
  /** `relay_ts_ms` from `khora.obp.frame.relay#RelayEnvelope` when hub relay is in use; `0` when unset (direct / tests). */
  relayTsMs: number;
};

/**
 * Host-supplied bind payload validation for NBC N4 when **`bind_policy`** is active.
 * Must throw **`ObpError`** with code **`VALIDATION`** on rejection.
 * Returns normalized **`Document`** for persistence (Standard Schema output).
 */
export type NbcBindPolicyValidateFn = (
  bindPolicy: JsonDocument | null,
  bindPayload: JsonDocument | null,
) => JsonDocument | Promise<JsonDocument>;

export type ValidateNbcBindInput = {
  timing: NbcBindTiming;
  offer: Offer;
  port: Port;
  offerBindWindow: ObpNbcBindWindow;
  portBindWindow: ObpNbcBindWindow;
  portsById: ReadonlyMap<string, Port>;
  targetPortIsExposed: boolean;
  /** Policy in effect for this port at expose time; `null` / empty object skips N4 schema. */
  bindPolicy: JsonDocument | null;
  bindPayload: JsonDocument | null;
  /** Required when {@link bindPolicy} is active (non-empty object). */
  validateBindPayload?: NbcBindPolicyValidateFn | undefined;
  /** Existing **BINDS** rows for canonical tally (N2/N5). */
  existingBinds: readonly { portId: string }[];
  /** Effective **`NbcPortExposePolicy.max_bindings`** on the canonical port row. */
  max_bindings: number;
};

export type ValidateNbcBindResult =
  | { readonly ok: true; readonly normalizedBindPayload: JsonDocument }
  | { readonly ok: false; readonly failure: NbcBindFailure };

/** N1 turn mode: bindable when **`expires_turn === 0`** or **`turnSeq < expires_turn`**. */
export function isTurnExpiryOk(expires_turn: number, turnSeq: number): boolean {
  if (expires_turn === 0) return true;
  return turnSeq < expires_turn;
}

/** N1 relay mode: bindable when **`expires_at_relay_ms === 0`** or **`relayTsMs < expires_at_relay_ms`**. */
export function isRelayExpiryOk(expires_at_relay_ms: number, relayTsMs: number): boolean {
  if (expires_at_relay_ms === 0) return true;
  if (relayTsMs === 0) return false;
  return relayTsMs < expires_at_relay_ms;
}

/** True when **`bind_policy`** is a non-empty object (N4 applies). */
export function isActiveBindPolicy(policy: JsonDocument | null): policy is JsonDocument {
  if (policy === null) return false;
  if (typeof policy !== "object" || Array.isArray(policy)) return false;
  return Object.keys(policy as object).length > 0;
}

function assertBindPayloadEmptyWhenInactive(bindPayload: JsonDocument | null): void {
  if (bindPayload === undefined || bindPayload === null) {
    return;
  }
  if (typeof bindPayload !== "object" || Array.isArray(bindPayload)) {
    throw new ObpError(
      "VALIDATION",
      "bind_payload must be omitted or empty when port has no bind_policy",
    );
  }
  if (Object.keys(bindPayload as object).length > 0) {
    throw new ObpError(
      "VALIDATION",
      "bind_payload must be omitted or empty when port has no bind_policy",
    );
  }
}

export type CheckNbcBindAdmissionInput = {
  timing: NbcBindTiming;
  offerId: string;
  portId: string;
  snapshot: BindPortTxnSnapshot;
};

/** Sync NBC admission checks (N1, N2/N5, N3, NOT_EXPOSED) against a store snapshot. */
export function checkNbcBindAdmission(input: CheckNbcBindAdmissionInput): NbcBindFailure | null {
  const { timing, offerId, portId, snapshot } = input;
  const { turnSeq, relayTsMs } = timing;
  const { portsById, binds, exposedPortIds, offerNbcById, portNbcById, portExposePolicyById } =
    snapshot;

  const offerBindWindow = offerNbcById.get(offerId);
  if (offerBindWindow === undefined) {
    return { code: "REF_MISSING", missingId: offerId };
  }
  const port = portsById.get(portId);
  if (port === undefined) {
    return { code: "REF_MISSING", missingId: portId };
  }
  const portBindWindow = portNbcById.get(portId);
  if (portBindWindow === undefined) {
    return { code: "REF_MISSING", missingId: portId };
  }

  if (!isTurnExpiryOk(offerBindWindow.nbc_expires_turn, turnSeq)) {
    return { code: "EXPIRED", entity: "offer" };
  }
  if (!isRelayExpiryOk(offerBindWindow.nbc_expires_at_relay_ms, relayTsMs)) {
    return { code: "EXPIRED", entity: "offer" };
  }
  if (!isTurnExpiryOk(portBindWindow.nbc_expires_turn, turnSeq)) {
    return { code: "EXPIRED", entity: "port" };
  }
  if (!isRelayExpiryOk(portBindWindow.nbc_expires_at_relay_ms, relayTsMs)) {
    return { code: "EXPIRED", entity: "port" };
  }

  if (!exposedPortIds.has(portId)) {
    return { code: "NOT_EXPOSED" };
  }

  const resolved = resolveCanonicalPortId(portsById, port.id);
  if (!resolved.ok) {
    if (resolved.reason === "cycle") {
      return { code: "REF_CYCLE", path: resolved.path };
    }
    return { code: "REF_MISSING", missingId: resolved.missingId };
  }

  const canonicalId = resolved.canonicalId;
  if (!portsById.has(canonicalId)) {
    return { code: "REF_MISSING", missingId: canonicalId };
  }

  const exposePolicy = portExposePolicyById.get(canonicalId);
  if (exposePolicy === undefined) {
    return { code: "REF_MISSING", missingId: canonicalId };
  }

  const bindCount = countBindsForCanonicalPort(binds, portsById, canonicalId);
  if (bindCount >= exposePolicy.max_bindings) {
    return {
      code: "MAX_BINDINGS_EXCEEDED",
      canonicalPortId: canonicalId,
      max_bindings: exposePolicy.max_bindings,
    };
  }

  return null;
}

/** N4 bind-payload normalization (runs before store txn; admission runs inside txn). */
export async function normalizeNbcBindPayload(input: {
  bindPolicy: JsonDocument | null;
  bindPayload: JsonDocument | null;
  validateBindPayload?: NbcBindPolicyValidateFn | undefined;
}): Promise<JsonDocument> {
  const { bindPolicy, bindPayload, validateBindPayload } = input;
  if (!isActiveBindPolicy(bindPolicy)) {
    assertBindPayloadEmptyWhenInactive(bindPayload);
    return bindPayload;
  }
  if (validateBindPayload === undefined) {
    throw new ObpError(
      "VALIDATION",
      "active bind_policy requires validateBindPayload (host bind policy validator not configured)",
    );
  }
  try {
    return await validateBindPayload(bindPolicy, bindPayload);
  } catch (e) {
    if (e instanceof ObpError && e.code === "VALIDATION") {
      throw e;
    }
    throw e;
  }
}

function snapshotFromValidateInput(input: ValidateNbcBindInput): BindPortTxnSnapshot {
  const portExposePolicyById = new Map<string, ObpPortExposePolicy>();
  const resolved = resolveCanonicalPortId(input.portsById, input.port.id);
  if (resolved.ok) {
    portExposePolicyById.set(resolved.canonicalId, {
      max_bindings: input.max_bindings,
      terminal: false,
      ttl_basis: null,
      ttl_measure: null,
      expose_seq: null,
    });
  }
  return {
    portsById: input.portsById,
    binds: input.existingBinds,
    exposedPortIds: new Set(input.targetPortIsExposed ? [input.port.id] : []),
    offerNbcById: new Map([[input.offer.id, input.offerBindWindow]]),
    portNbcById: new Map([[input.port.id, input.portBindWindow]]),
    portExposePolicyById,
  };
}

/**
 * Pure bind validation for bilateral NBC.
 */
export async function validateNbcBind(input: ValidateNbcBindInput): Promise<ValidateNbcBindResult> {
  const { offer, port, bindPolicy, bindPayload, validateBindPayload } = input;

  const admissionFailure = checkNbcBindAdmission({
    timing: input.timing,
    offerId: offer.id,
    portId: port.id,
    snapshot: snapshotFromValidateInput(input),
  });
  if (admissionFailure !== null) {
    return { ok: false, failure: admissionFailure };
  }

  try {
    const normalizedBindPayload = await normalizeNbcBindPayload({
      bindPolicy,
      bindPayload,
      validateBindPayload,
    });
    return { ok: true, normalizedBindPayload };
  } catch (e) {
    if (e instanceof ObpError && e.code === "VALIDATION") {
      return {
        ok: false,
        failure: { code: "POLICY_REJECTED", reason: e.message },
      };
    }
    throw e;
  }
}
