/**
 * Sorted-key canonical JSON for AJV compile-cache keys (`SCHEMA_CACHE_CANONICAL_JSON`).
 * Frame signing uses a separate implementation in `@khoralabs/obp-frames-impl` (`undefined` → `null`).
 */

export type CanonicalUndefinedPolicy = "omit";

export type CanonicalJsonPolicy = {
  undefined: CanonicalUndefinedPolicy;
};

/** Sorted-key JSON for AJV compile-cache keys; object keys with `undefined` values are dropped. */
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
