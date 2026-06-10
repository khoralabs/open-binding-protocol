import { describe, expect, test } from "bun:test";
import { ObpError } from "@khoralabs/obp-errors";

import { canonicalSessionParties } from "./frame-init-wire";
import { runFrameMultiplexSession } from "./frame-multiplex-session";
import { templateMatch } from "./frame-multiplex-session-helpers";
import type { SessionInitNormalized, SessionParty } from "./frame-protocol-types";
import { toSha256HexLower } from "./frame-protocol-types";

const gh = toSha256HexLower("a".repeat(64));
const ghOther = toSha256HexLower("b".repeat(64));

const pA: SessionParty = { id: "party-a", pubkey: "0x02" };
const pB: SessionParty = { id: "party-b", pubkey: "0x01" };
const parties = canonicalSessionParties([pA, pB]);

const baseInit: SessionInitNormalized = {
  session_id: "session-1",
  genesis_hash: gh,
  parties,
};

describe("templateMatch", () => {
  test("matches parties when session_id and genesis_hash are not pinned", () => {
    expect(templateMatch(baseInit, { parties })).toBe(true);
  });

  test("rejects wrong session_id when pinned", () => {
    expect(
      templateMatch(
        { ...baseInit, session_id: "attacker-session" },
        { parties, session_id: "session-1", genesis_hash: gh },
      ),
    ).toBe(false);
  });

  test("rejects wrong genesis_hash when pinned", () => {
    expect(
      templateMatch(
        { ...baseInit, genesis_hash: ghOther },
        { parties, session_id: "session-1", genesis_hash: gh },
      ),
    ).toBe(false);
  });

  test("accepts full pin when wire matches", () => {
    expect(
      templateMatch(baseInit, {
        parties,
        session_id: "session-1",
        genesis_hash: gh,
      }),
    ).toBe(true);
  });
});

describe("runFrameMultiplexSession validation", () => {
  test("responder sessionTemplate requires session_id and genesis_hash", async () => {
    const channel = {
      async *read(): AsyncGenerator<Uint8Array> {},
      async write(): Promise<void> {},
      async close(): Promise<void> {},
    };
    const signer = { actor: "0x01", sign: async () => "" };
    const verifier = { verify: async () => true };
    const client = {} as never;

    await expect(
      runFrameMultiplexSession({
        channel,
        signer,
        verifier,
        client,
        sessionTemplate: { parties },
        handlers: {},
      }),
    ).rejects.toThrow(
      new ObpError(
        "VALIDATION",
        "responder sessionTemplate requires session_id and genesis_hash (out-of-band genesis agreement)",
      ),
    );
  });
});
