import { createHash } from "node:crypto";
import { ObpError } from "@khoralabs/obp-core";
import type { FrameLikeForSessionOp } from "../session/index";

import type { Frame, SessionInitNormalized, SessionParty } from "./frame-protocol-types";
import type { FrameSigner } from "./frame-signer";

/** Host-expected session bootstrap; pin `session_id` / `genesis_hash` on responders to block init substitution. */
export type SessionInitTemplate = {
  parties: readonly [SessionParty, SessionParty];
  session_id?: string;
  genesis_hash?: string;
};

export function partyIdForActor(init: SessionInitNormalized, actor: string): string {
  const p = init.parties.find((x) => x.pubkey === actor);
  if (p === undefined) throw new ObpError("VALIDATION", `unknown actor ${actor}`);
  return p.id;
}

export function templateMatch(wire: SessionInitNormalized, t: SessionInitTemplate): boolean {
  if (
    wire.parties[0].id !== t.parties[0].id ||
    wire.parties[1].id !== t.parties[1].id ||
    wire.parties[0].pubkey !== t.parties[0].pubkey ||
    wire.parties[1].pubkey !== t.parties[1].pubkey
  ) {
    return false;
  }
  if (t.session_id !== undefined && wire.session_id !== t.session_id) {
    return false;
  }
  if (t.genesis_hash !== undefined && wire.genesis_hash !== t.genesis_hash) {
    return false;
  }
  return true;
}

export function ensureSignerInSession(init: SessionInitNormalized, signer: FrameSigner): void {
  if (!init.parties.some((p) => p.pubkey === signer.actor)) {
    throw new ObpError("VALIDATION", `signer.actor ${signer.actor} not in session parties`);
  }
}

export function remoteActorForSigner(init: SessionInitNormalized, signer: FrameSigner): string {
  const remote = init.parties.find((p) => p.pubkey !== signer.actor)?.pubkey;
  if (remote === undefined) {
    throw new ObpError("VALIDATION", "cannot resolve remote actor");
  }
  return remote;
}

export function frameDedupeKeyHex(frame: Frame): string {
  return createHash("sha256").update(`${frame.p_hash}:${frame.sig}`, "utf8").digest("hex");
}

export function frameAsOpLike(frame: Frame): FrameLikeForSessionOp {
  return {
    type: frame.type as FrameLikeForSessionOp["type"],
    actor: frame.actor,
    body: frame.body as Record<string, unknown>,
  };
}
