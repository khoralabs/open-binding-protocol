/**
 * TypeScript models for **`khora.obp.session`** — see
 * `packages/session/spec/model/session-protocol.smithy`.
 *
 * `SessionInit` / `SessionParty` wire helpers live in **`@khoralabs/obp-wire`** (`khora.obp.frame`).
 */

import type { JsonDocument, Sha256HexLower } from "@khoralabs/obp-core";

/**
 * `SessionOp` — ordered session log entry (Smithy `structure SessionOp`).
 * Frame-derived **`kind`** values include **`turn`**, **`end_offers`** (from **`END_OFFERS`** frames), **`terminate`**, …
 */
export type SessionOp = {
  kind: string;
  payload: JsonDocument;
  /** Multiplex: same string as that chain's `SessionInit.session_id`; use `""` when a single chain omits it on the wire. */
  session_id: string;
};

/** `SessionOpList` — ordered list of ops in `SessionEnvelope.delta_ops`. */
export type SessionOpList = readonly SessionOp[];

/** `Checkpoint` — Merkle commitment over `op_0 … op_{seq-1}`. */
export type Checkpoint = {
  seq: bigint;
  root_hex: Sha256HexLower;
};

/** `SessionEnvelope` — logical sync message (transport-agnostic). */
export type SessionEnvelope = {
  session_id: string;
  from_party: string;
  base_checkpoint: Checkpoint;
  delta_ops: SessionOpList;
  new_checkpoint: Checkpoint;
};

/** `SeqMismatchError` — verification: prefix length does not match claimed `seq`. */
export type SeqMismatchError = {
  expected: bigint;
  actual: bigint;
};

/** `RootMismatchError` — verification: Merkle root does not match after replay. */
export type RootMismatchError = {
  expected_hex: Sha256HexLower;
  recomputed_hex: Sha256HexLower;
};

/** `VerifyError` — discriminated verification failure (Smithy `union VerifyError`). */
export type VerifyError =
  | { readonly seqMismatch: SeqMismatchError }
  | { readonly rootMismatch: RootMismatchError };

/** Service version string from `NegotiationSessionProtocol` in Smithy. */
export const NEGOTIATION_SESSION_PROTOCOL_VERSION = "2026-05-15" as const;
