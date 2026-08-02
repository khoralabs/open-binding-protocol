import { describe, expect, test } from "bun:test";

import { SCHEMA_CACHE_CANONICAL_JSON, stableStringify } from "./stable-stringify";

describe("stableStringify", () => {
  test("sorts object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  test("omit policy drops undefined object properties", () => {
    expect(stableStringify({ a: 1, b: undefined }, SCHEMA_CACHE_CANONICAL_JSON)).toBe('{"a":1}');
  });
});
