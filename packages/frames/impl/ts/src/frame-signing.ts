/**
 * **`signing_bytes`** and post-frame **tip** hash from `NegotiationFrameProtocol` docs in
 * `packages/frames/spec/model/frame-protocol.smithy`.
 */

import { type Sha256HexLower, sha256HexLowerFromBytes } from "@khoralabs/obp-primitives";
import { canonicalJsonString } from "./canonical-json";
import type { Frame } from "./frame-protocol-types";

/** `signing_payload`: same fields as `Frame` with **`sig`** set to the empty string. */
export type FrameSigningPayload = Omit<Frame, "sig"> & { sig: "" };

export function frameSigningPayload(frame: Frame): FrameSigningPayload {
  return {
    p_hash: frame.p_hash,
    actor: frame.actor,
    sig: "",
    type: frame.type,
    body: frame.body,
  };
}

/** `signing_bytes = UTF-8(canonical_json(signing_payload))`. */
export function signingBytesUtf8(frame: Frame): Uint8Array {
  return new TextEncoder().encode(canonicalJsonString(frameSigningPayload(frame)));
}

/**
 * Local DAG tip after accepting a frame: **`SHA-256( UTF-8(canonical_json(frame_complete)) )`**
 * as **`Sha256HexLower`** (next frame's **`p_hash`** MUST equal this).
 */
export function tipSha256HexFromCompleteFrame(frame: Frame): Sha256HexLower {
  return sha256HexLowerFromBytes(new TextEncoder().encode(canonicalJsonString(frame)));
}
