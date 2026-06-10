import { describe, expect, test } from "bun:test";

import { bytesToHexLower, hexToBytes, hexToBytes32 } from "./hex";

describe("hex", () => {
  test("bytesToHexLower roundtrip", () => {
    const raw = new Uint8Array([0, 1, 255, 16]);
    expect(bytesToHexLower(raw)).toBe("0001ff10");
    expect(hexToBytes("0001ff10")).toEqual(raw);
  });

  test("hexToBytes32", () => {
    const hex = "ab".repeat(32);
    expect(hexToBytes32(hex, "test").length).toBe(32);
    expect(() => hexToBytes32("zz", "test")).toThrow();
  });
});
