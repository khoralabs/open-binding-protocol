const HEX = /^[0-9a-f]*$/;
const HEX_LOWER = /^[0-9a-f]+$/;

export function bytesToHexLower(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !HEX.test(hex)) {
    throw new Error("invalid hex string");
  }
  const len = hex.length / 2;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buf[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return Uint8Array.from(buf);
}

export function hexToBytes32(hex: string, field: string): Uint8Array {
  const h = hex.trim().toLowerCase();
  if (h.length !== 64 || !HEX_LOWER.test(h)) {
    throw new TypeError(`${field}: expected 64-char hex (32 bytes)`);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = Number.parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
