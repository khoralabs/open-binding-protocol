import type { JsonDocument } from "@khoralabs/obp-model";

type CanonicalJsonPolicy = {
  undefined: "null" | "omit";
};

/** Frame `canonical_json` per `khora.obp.frame#NegotiationFrameProtocol` (`undefined` → JSON `null`). */
const FRAME_SIGNING_CANONICAL_JSON: CanonicalJsonPolicy = { undefined: "null" };

function stableStringifyInner(value: unknown, policy: CanonicalJsonPolicy): string {
  if (value === undefined) {
    return "null";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifyInner(item, policy)).join(",")}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const v = o[k];
    if (v === undefined && policy.undefined === "omit") {
      continue;
    }
    parts.push(`${JSON.stringify(k)}:${stableStringifyInner(v, policy)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * UTF-8 bytes of **`canonical_json(v)`** per **`NegotiationFrameProtocol`**
 * (`packages/frames/spec/model/frame-protocol.smithy`).
 */
export function canonicalJsonUtf8(value: JsonDocument | unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJsonString(value));
}

export function canonicalJsonString(value: JsonDocument | unknown): string {
  return stableStringifyInner(value, FRAME_SIGNING_CANONICAL_JSON);
}
