import { describe, expect, test } from "bun:test";
import {
  conservativeEffectiveNow,
  createHlcState,
  estimateSkewMs,
  recvHlc,
  sendHlc,
} from "./nbc-hlc";

describe("nbc-hlc", () => {
  test("send/recv merge monotonicity", () => {
    const local = createHlcState(1000);
    const sent = sendHlc(local, 1000);
    expect(sent.pt).toBe(1000);
    expect(sent.lc).toBe(1);
    recvHlc(local, { pt: 1005, lc: 0 }, 1002);
    expect(local.pt).toBe(1005);
  });

  test("estimateSkewMs from samples", () => {
    const skew = estimateSkewMs([
      { peer_pt: 1000, recv_ms: 1100 },
      { peer_pt: 2000, recv_ms: 2100 },
    ]);
    expect(skew?.offsetMs).toBe(100);
    expect(skew?.count).toBe(2);
  });

  test("conservativeEffectiveNow fail closed without samples", () => {
    const state = createHlcState(5000);
    expect(conservativeEffectiveNow(state, 5000, [])).toBeNull();
  });

  test("conservativeEffectiveNow with samples", () => {
    const state = createHlcState(5000);
    const now = conservativeEffectiveNow(state, 5000, [{ peer_pt: 4900, recv_ms: 5000 }]);
    expect(now).toBeGreaterThanOrEqual(5000);
  });
});
