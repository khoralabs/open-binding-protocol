/** `Sha256HexLower` — lowercase hex, 32-byte digest, length **64**, no `0x`. */
export type Sha256HexLower = string & { readonly __brand?: "Sha256HexLower" };

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function isSha256HexLower(s: string): s is Sha256HexLower {
  return SHA256_HEX.test(s);
}

export function toSha256HexLower(s: string): Sha256HexLower {
  if (!SHA256_HEX.test(s)) {
    throw new TypeError("expected 64-char lowercase hex Sha256HexLower");
  }
  return s as Sha256HexLower;
}
