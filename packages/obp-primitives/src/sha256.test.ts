import { describe, expect, test } from "bun:test";
import { sha256HexLowerFromBytes, sha256HexLowerFromUtf8String } from "./sha256";
import { isSha256HexLower, toSha256HexLower } from "./sha256-hex-lower";

describe("sha256", () => {
  test("sha256HexLowerFromUtf8String", () => {
    const h = sha256HexLowerFromUtf8String("hello");
    expect(isSha256HexLower(h)).toBe(true);
    expect(h).toBe(
      toSha256HexLower("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"),
    );
  });

  test("sha256HexLowerFromBytes matches utf8 string", () => {
    const utf8 = new TextEncoder().encode("hello");
    expect(sha256HexLowerFromBytes(utf8)).toBe(sha256HexLowerFromUtf8String("hello"));
  });
});
