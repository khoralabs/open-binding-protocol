/**
 * Apply one bilateral NBC turn: **`ExtendOffer`**, optional **`ExposePort`**s, optional **`BindPort`**.
 */

import type { JsonDocument, Offer } from "@khoralabs/obp-core";
import { ObpError } from "@khoralabs/obp-core";
import type { ObpPersistenceClient } from "@khoralabs/obp-core/persistence";
import {
  checkNbcBindAdmission,
  isActiveBindPolicy,
  type NbcBindFailure,
  type NbcBindPolicyValidateFn,
  type NbcBindTiming,
  normalizeNbcBindPayload,
  resolveNbcBindPolicyForPort,
} from "./nbc-invariants";
import { type NbcTurnBody, nbcPortSpecToPort } from "./nbc-types";

export type ApplyNbcTurnParams = {
  /** Party id on **`EXTENDS`** for the new offer (`ExtendOffer.partyId`). */
  partyId: string;
  body: NbcTurnBody;
  client: ObpPersistenceClient;
  timing: NbcBindTiming;
  /** NBC N4: host validation when **`bind_policy`** is active on the bind target port. */
  validateBindPayload?: NbcBindPolicyValidateFn | undefined;
};

export type ApplyNbcTurnResult = {
  offerId: string;
  offer: Offer;
  exposedPortIds: readonly string[];
};

export function obpErrorFromBindFailure(f: NbcBindFailure): ObpError {
  switch (f.code) {
    case "EXPIRED":
      return new ObpError("EXPIRED", `${f.entity} expired (NBC N1)`);
    case "NOT_EXPOSED":
      return new ObpError("NOT_EXPOSED", "bind target port is not exposed");
    case "REF_CYCLE":
      return new ObpError("REF_CYCLE", `port ref cycle: ${f.path.join(" -> ")}`);
    case "REF_MISSING":
      return new ObpError("REF_MISSING", `port ref missing: ${f.missingId}`);
    case "POLICY_REJECTED":
      return new ObpError("VALIDATION", f.reason);
    case "MAX_BINDINGS_EXCEEDED":
      return new ObpError(
        "MAX_BINDINGS",
        `max_bindings (${f.max_bindings}) exceeded for canonical port ${f.canonicalPortId}`,
      );
    default: {
      const _exhaustive: never = f;
      return _exhaustive;
    }
  }
}

/**
 * Commit **`body`** to **`client`**: extend offer, expose ports, optionally bind.
 * @throws {ObpError} on bind validation failure; @throws {TypeError} from invalid **`body`** shape upstream if caller skipped parse.
 */
export async function applyNbcTurn(params: ApplyNbcTurnParams): Promise<ApplyNbcTurnResult> {
  const { partyId, body, client, timing, validateBindPayload } = params;

  const { offer } = await client.extendOffer({
    partyId,
    offer: {
      id: body.offer.id,
      type: body.offer.type,
    },
    nbc_expires_turn: body.offer.expires_turn,
    nbc_expires_at_ms: body.offer.expires_at_ms,
    bindPortId: "",
    bind_payload: null,
  });
  const offerId = offer.id;
  const exposedPortIds: string[] = [];
  const localPolicy = new Map<string, JsonDocument>();

  for (const spec of body.ports) {
    const { port } = await client.exposePort({
      offerId,
      port: nbcPortSpecToPort(spec),
      nbc_expires_turn: spec.expires_turn,
      nbc_expires_at_ms: spec.expires_at_ms,
      bind_policy: spec.bind_policy ?? null,
      max_bindings: spec.max_bindings,
      terminal: spec.terminal,
    });
    exposedPortIds.push(port.id);
    if (isActiveBindPolicy(spec.bind_policy)) {
      localPolicy.set(port.id, spec.bind_policy);
    }
  }

  if (body.bind_port_id !== "") {
    const bindPolicy = await resolveNbcBindPolicyForPort({
      bindPortId: body.bind_port_id,
      localPolicy,
      client,
    });

    const normalizedBindPayload = await normalizeNbcBindPayload({
      bindPolicy,
      bindPayload: body.bind_payload,
      validateBindPayload,
      portId: body.bind_port_id,
    });

    await client.bindPort({
      offerId,
      portId: body.bind_port_id,
      bind_payload: normalizedBindPayload,
      assertAdmissible: (snapshot) => {
        const failure = checkNbcBindAdmission({
          timing,
          offerId,
          portId: body.bind_port_id,
          snapshot,
        });
        if (failure !== null) {
          throw obpErrorFromBindFailure(failure);
        }
      },
    });
  }

  return { offerId, offer, exposedPortIds };
}
