import { describe, expect, test } from "bun:test";
import {
  createMemoryDuplexByteStreamPair,
  sha256HexLowerFromUtf8String,
} from "@khoralabs/obp-core";
import { createInMemoryObpPersistenceClient } from "@khoralabs/obp-core/persistence";
import { parseNbcTurnBody } from "@khoralabs/obp-nbc";
import { canonicalSessionParties } from "./frame-init-wire";
import { runFrameMultiplexSession } from "./frame-multiplex-session";
import type { FrameSessionHandle } from "./frame-mux-types";
import {
  createEd25519FrameSigner,
  createEd25519FrameVerifier,
  generateEd25519KeyPair,
} from "./frame-signer";

function openingTurn(type: string) {
  return parseNbcTurnBody({
    offer: { id: "", type, expires_turn: 0, expires_at_ms: 0 },
    ports: [
      {
        id: "",
        kind: "slot",
        promise: type,
        expires_turn: 0,
        expires_at_ms: 0,
        bind_policy: null,
        ref: "",
      },
    ],
    bind_port_id: "",
    bind_payload: null,
  });
}

describe("emitOutboundTurn DAG tip", () => {
  test("two sequential outbound TURNs advance local tip without waiting for echo", async () => {
    const [aliceCh, bobCh] = createMemoryDuplexByteStreamPair();
    const aliceKp = await generateEd25519KeyPair();
    const bobKp = await generateEd25519KeyPair();
    const aliceSigner = await createEd25519FrameSigner(aliceKp.privateKey, aliceKp.publicKey);
    const bobSigner = await createEd25519FrameSigner(bobKp.privateKey, bobKp.publicKey);
    const verifier = createEd25519FrameVerifier();
    const aliceClient = createInMemoryObpPersistenceClient();
    const bobClient = createInMemoryObpPersistenceClient();
    const genesis = sha256HexLowerFromUtf8String("outbound-tip-genesis");
    const parties = canonicalSessionParties([
      { id: "alice", pubkey: aliceSigner.actor },
      { id: "bob", pubkey: bobSigner.actor },
    ]);
    const init = { session_id: "s-tip", genesis_hash: genesis, parties };

    for (const client of [aliceClient, bobClient]) {
      await client.registerParty({ id: "alice", name: "alice" });
      await client.registerParty({ id: "bob", name: "bob" });
    }

    let tips: string[] = [];
    let resolveTips: () => void = () => {};
    const tipsReady = new Promise<void>((resolve) => {
      resolveTips = resolve;
    });

    const aliceDone = runFrameMultiplexSession({
      channel: aliceCh,
      signer: aliceSigner,
      verifier,
      client: aliceClient,
      handlers: {},
      closeChannelWhenIdle: false,
      openerSession: async (api) => {
        const handle: FrameSessionHandle = await api.init(init);
        expect(handle.tipHash).toBe(genesis);
        await handle.sendTurn(openingTurn("one"));
        const afterFirst = handle.tipHash;
        expect(afterFirst).not.toBe(genesis);
        await handle.sendTurn(openingTurn("two"));
        const afterSecond = handle.tipHash;
        expect(afterSecond).not.toBe(afterFirst);
        tips = [genesis, afterFirst, afterSecond];
        resolveTips();
      },
    });

    void runFrameMultiplexSession({
      channel: bobCh,
      signer: bobSigner,
      verifier,
      client: bobClient,
      closeChannelWhenIdle: false,
      sessionTemplate: {
        parties,
        session_id: init.session_id,
        genesis_hash: genesis,
      },
      handlers: {},
    });

    await Promise.race([
      tipsReady,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("outbound turns timed out")), 5000);
      }),
    ]);
    await aliceCh.close();
    await aliceDone.catch(() => {});
    expect(tips).toHaveLength(3);
    expect(new Set(tips).size).toBe(3);
  });
});
