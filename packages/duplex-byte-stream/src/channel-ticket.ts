function bytesToHex(buf: Uint8Array): string {
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Copy bytes into a standalone `ArrayBuffer` so WebCrypto accepts `BufferSource` under strict TS. */
function uint8ArrayToDetachedArrayBuffer(u: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u.byteLength);
  copy.set(u);
  return copy.buffer;
}

export function generateChannelSecretHex(byteLength = 32): string {
  const raw = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToHex(raw);
}

function toB64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromB64Url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

async function importHmacKey(secretHex: string): Promise<CryptoKey> {
  const keyMaterial = Uint8Array.from(Buffer.from(secretHex, "hex"));
  return crypto.subtle.importKey(
    "raw",
    uint8ArrayToDetachedArrayBuffer(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function channelIdPayloadBytes(channelId: string): Uint8Array {
  return new TextEncoder().encode(channelId);
}

/** Compare UTF-8 payloads without early exit (length + bytes). */
function constantTimeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const av = a.at(i) ?? 0;
    const bv = b.at(i) ?? 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

/**
 * HMAC-SHA256(utf8(channelId)). Relay-scoped join proof; no OBP types.
 * Wire: base64url(payload).base64url(sig)
 */
export async function signChannelTicket(channelId: string, secretHex: string): Promise<string> {
  const payloadBytes = channelIdPayloadBytes(channelId);
  const key = await importHmacKey(secretHex);
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    uint8ArrayToDetachedArrayBuffer(payloadBytes),
  );
  return `${toB64Url(payloadBytes)}.${toB64Url(new Uint8Array(sigBuf))}`;
}

export async function verifyChannelTicket(
  channelId: string,
  ticket: string,
  secretHex: string,
): Promise<boolean> {
  const dot = ticket.indexOf(".");
  if (dot < 1) return false;
  const payloadB64 = ticket.slice(0, dot);
  const sigB64 = ticket.slice(dot + 1);
  if (payloadB64 === "" || sigB64 === "") return false;
  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = fromB64Url(payloadB64);
    sigBytes = fromB64Url(sigB64);
  } catch {
    return false;
  }
  const expected = channelIdPayloadBytes(channelId);
  if (!constantTimeEqualBytes(payloadBytes, expected)) return false;
  const key = await importHmacKey(secretHex);
  return crypto.subtle.verify(
    "HMAC",
    key,
    uint8ArrayToDetachedArrayBuffer(sigBytes),
    uint8ArrayToDetachedArrayBuffer(payloadBytes),
  );
}
