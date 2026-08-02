/** Ed25519 frame signatures (hex-encoded raw pubkey + hex-encoded 64-byte sig). */

import { bytesToHexLower, hexToBytes } from "@khoralabs/obp-core";

export type FrameSigner = {
  readonly actor: string;
  sign(bytes: Uint8Array): Promise<string>;
};

export type FrameVerifier = {
  verify(actor: string, bytes: Uint8Array, sigHex: string): Promise<boolean>;
};

function isCryptoKeyPair(v: CryptoKeyPair | CryptoKey): v is CryptoKeyPair {
  return (
    typeof v === "object" &&
    v !== null &&
    "privateKey" in v &&
    "publicKey" in v &&
    v.privateKey instanceof CryptoKey &&
    v.publicKey instanceof CryptoKey
  );
}

/** Ed25519 `generateKey` always yields a pair in Web Crypto; TS types it as a union. */
export async function generateEd25519KeyPair(): Promise<CryptoKeyPair> {
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  if (!isCryptoKeyPair(kp)) {
    throw new Error(
      "generateEd25519KeyPair: expected CryptoKeyPair from subtle.generateKey(Ed25519)",
    );
  }
  return kp;
}

export async function publicKeyActorHex(publicKey: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
  return bytesToHexLower(raw);
}

export async function importEd25519PublicKeyFromActorHex(actor: string): Promise<CryptoKey> {
  const raw = hexToBytes(actor);
  return crypto.subtle.importKey("raw", raw as never, { name: "Ed25519" }, true, ["verify"]);
}

export async function createEd25519FrameSigner(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<FrameSigner> {
  const actor = await publicKeyActorHex(publicKey);
  return {
    actor,
    async sign(bytes: Uint8Array): Promise<string> {
      const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, bytes as never));
      return bytesToHexLower(sig);
    },
  };
}

export function createEd25519FrameVerifier(): FrameVerifier {
  return {
    async verify(actor: string, bytes: Uint8Array, sigHex: string): Promise<boolean> {
      try {
        const pk = await importEd25519PublicKeyFromActorHex(actor);
        const sig = hexToBytes(sigHex);
        return crypto.subtle.verify("Ed25519", pk, sig as never, bytes as never);
      } catch {
        return false;
      }
    },
  };
}
