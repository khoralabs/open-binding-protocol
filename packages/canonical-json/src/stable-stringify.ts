/**
 * How `undefined` is encoded in canonical JSON.
 *
 * - `"null"` — every `undefined` becomes JSON `null` (frame signing / tip hashing).
 * - `"omit"` — object keys whose value is `undefined` are dropped (schema cache keys).
 */
export type CanonicalUndefinedPolicy = "null" | "omit";

export type CanonicalJsonPolicy = {
  undefined: CanonicalUndefinedPolicy;
};

/** Frame `canonical_json` per `khora.obp.frame#NegotiationFrameProtocol`. */
export const FRAME_SIGNING_CANONICAL_JSON: CanonicalJsonPolicy = { undefined: "null" };

/** Sorted-key JSON for AJV compile-cache keys and other plain JSON objects. */
export const SCHEMA_CACHE_CANONICAL_JSON: CanonicalJsonPolicy = { undefined: "omit" };

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

/** UTF-8-oriented canonical JSON string (sorted object keys, stable array order). */
export function stableStringify(
  value: unknown,
  policy: CanonicalJsonPolicy = SCHEMA_CACHE_CANONICAL_JSON,
): string {
  return stableStringifyInner(value, policy);
}

export function canonicalJsonString(
  value: unknown,
  policy: CanonicalJsonPolicy = FRAME_SIGNING_CANONICAL_JSON,
): string {
  return stableStringify(value, policy);
}

export function canonicalJsonUtf8(
  value: unknown,
  policy: CanonicalJsonPolicy = FRAME_SIGNING_CANONICAL_JSON,
): Uint8Array {
  return new TextEncoder().encode(canonicalJsonString(value, policy));
}
