import { describe, expect, test } from "bun:test";

import {
  createEd25519FrameSigner,
  createEd25519FrameVerifier,
  generateEd25519KeyPair,
} from "./frame-signer";

describe("createEd25519FrameVerifier", () => {
  test("returns false for malformed actor hex", async () => {
    const verifier = createEd25519FrameVerifier();
    const ok = await verifier.verify("not-hex!", new Uint8Array([1]), "aa".repeat(64));
    expect(ok).toBe(false);
  });

  test("returns false for malformed sig hex", async () => {
    const kp = await generateEd25519KeyPair();
    const signer = await createEd25519FrameSigner(kp.privateKey, kp.publicKey);
    const verifier = createEd25519FrameVerifier();
    const ok = await verifier.verify(signer.actor, new Uint8Array([1]), "zz");
    expect(ok).toBe(false);
  });

  test("returns true for valid signature", async () => {
    const kp = await generateEd25519KeyPair();
    const signer = await createEd25519FrameSigner(kp.privateKey, kp.publicKey);
    const verifier = createEd25519FrameVerifier();
    const bytes = new Uint8Array([1, 2, 3]);
    const sig = await signer.sign(bytes);
    expect(await verifier.verify(signer.actor, bytes, sig)).toBe(true);
  });
});
