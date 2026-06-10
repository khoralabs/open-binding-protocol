import {
  FRAME_SIGNING_CANONICAL_JSON,
  canonicalJsonString as sharedCanonicalJsonString,
  canonicalJsonUtf8 as sharedCanonicalJsonUtf8,
} from "@khoralabs/canonical-json";

import type { JsonDocument } from "./frame-protocol-types";

/**
 * UTF-8 bytes of **`canonical_json(v)`** per **`NegotiationFrameProtocol`**
 * (`packages/frames/spec/model/frame-protocol.smithy`).
 */
export function canonicalJsonUtf8(value: JsonDocument | unknown): Uint8Array {
  return sharedCanonicalJsonUtf8(value, FRAME_SIGNING_CANONICAL_JSON);
}

export function canonicalJsonString(value: JsonDocument | unknown): string {
  return sharedCanonicalJsonString(value, FRAME_SIGNING_CANONICAL_JSON);
}
