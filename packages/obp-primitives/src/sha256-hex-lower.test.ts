import { describe, expect, test } from "bun:test";

import { isSha256HexLower, toSha256HexLower } from "./sha256-hex-lower";

describe("Sha256HexLower", () => {
  test("toSha256HexLower", () => {
    const h = "a".repeat(64);
    expect(toSha256HexLower(h)).toBe(h);
    expect(isSha256HexLower(h)).toBe(true);
  });

  test("rejects invalid", () => {
    expect(isSha256HexLower("GG".repeat(32))).toBe(false);
    expect(isSha256HexLower("a".repeat(63))).toBe(false);
    expect(() => toSha256HexLower("short")).toThrow();
  });
});
