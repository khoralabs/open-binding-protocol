import { createHash } from "node:crypto";

import { bytesToHexLower } from "./hex";
import { type Sha256HexLower, toSha256HexLower } from "./sha256-hex-lower";

export function sha256Bytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(data).digest());
}

export function sha256HexLowerFromBytes(data: Uint8Array): Sha256HexLower {
  return toSha256HexLower(bytesToHexLower(sha256Bytes(data)));
}

export function sha256HexLowerFromUtf8String(text: string): Sha256HexLower {
  return sha256HexLowerFromBytes(new TextEncoder().encode(text));
}
