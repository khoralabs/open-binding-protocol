import { describe, expect, test } from "bun:test";

import { FrameRelaySqliteError } from "./errors";
import {
  decryptPairingSecretHex,
  encryptPairingSecretHex,
  isEncryptedPairingSecret,
} from "./pairing-secret-cipher";
import { pairingSecretKeyFromHex, TEST_PAIRING_SECRET_KEY_HEX } from "./pairing-secret-key";

const key = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX);

describe("pairing secret cipher", () => {
  test("roundtrip encrypt / decrypt", () => {
    const hex = "deadbeefcafebabe";
    const stored = encryptPairingSecretHex(hex, key);
    expect(isEncryptedPairingSecret(stored)).toBe(true);
    expect(decryptPairingSecretHex(stored, key)).toBe(hex);
  });

  test("legacy plaintext hex passes through on read", () => {
    expect(decryptPairingSecretHex("abc123", key)).toBe("abc123");
  });

  test("wrong key fails decrypt", () => {
    const stored = encryptPairingSecretHex("aa", key);
    const other = pairingSecretKeyFromHex(TEST_PAIRING_SECRET_KEY_HEX.replace(/^01/, "ff"));
    expect(() => decryptPairingSecretHex(stored, other)).toThrow(FrameRelaySqliteError);
  });
});
