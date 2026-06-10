import { describe, expect, test } from "bun:test";
import { encodeFramedJson } from "@khoralabs/obp-frames-impl";
import { relayOutBytesForMessage } from "./relay-envelope";

describe("relayOutBytesForMessage", () => {
  const frame = {
    p_hash: "a".repeat(64),
    actor: "00",
    sig: "s",
    type: "TURN",
    body: {},
  };

  test("stamps hub relay_ts_ms on bare negotiation frames", () => {
    const hubTs = 1_700_000_000_000;
    const out = relayOutBytesForMessage(encodeFramedJson(frame), hubTs);
    if (out === null) {
      throw new Error("expected wrapped relay envelope");
    }

    const len = new DataView(out.buffer, out.byteOffset, out.byteLength).getUint32(0, false);
    const json = JSON.parse(new TextDecoder().decode(out.subarray(4, 4 + len))) as {
      relay_ts_ms: number;
      frame: { type: string };
    };
    expect(json.relay_ts_ms).toBe(hubTs);
    expect(json.frame.type).toBe("TURN");
  });

  test("rejects pre-wrapped relay envelopes", () => {
    const forged = encodeFramedJson({
      frame,
      relay_ts_ms: 1,
    });
    expect(relayOutBytesForMessage(forged)).toBeNull();
  });

  test("passes through init envelopes unchanged", () => {
    const init = encodeFramedJson({
      init: { session_id: "s", genesis_hash: "g" },
    });
    expect(relayOutBytesForMessage(init)).toEqual(init);
  });
});
