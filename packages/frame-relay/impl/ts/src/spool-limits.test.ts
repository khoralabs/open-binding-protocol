import { describe, expect, test } from "bun:test";
import { capReplayTail, trimSpoolToLimits } from "./spool-limits";
import type { RelayedFrameRecord } from "./store-types";

function frame(id: number, size: number): RelayedFrameRecord {
  return { id, bytes: new Uint8Array(size) };
}

describe("trimSpoolToLimits", () => {
  test("drops oldest frames when over maxFramesPerChannel", () => {
    const frames = [frame(1, 1), frame(2, 1), frame(3, 1)];
    const trimmed = trimSpoolToLimits(frames, {
      maxFramesPerChannel: 2,
      maxBytesPerChannel: 1024,
    });
    expect(trimmed.map((r) => r.id)).toEqual([2, 3]);
  });

  test("drops oldest frames when over maxBytesPerChannel", () => {
    const frames = [frame(1, 10), frame(2, 10), frame(3, 10)];
    const trimmed = trimSpoolToLimits(frames, {
      maxFramesPerChannel: 100,
      maxBytesPerChannel: 25,
    });
    expect(trimmed.map((r) => r.id)).toEqual([2, 3]);
  });
});

describe("capReplayTail", () => {
  test("keeps newest frames when over maxReplayFrames", () => {
    const frames = [frame(1, 1), frame(2, 1), frame(3, 1)];
    const capped = capReplayTail(frames, { maxReplayFrames: 2, maxReplayBytes: 1024 });
    expect(capped.map((r) => r.id)).toEqual([2, 3]);
  });

  test("keeps newest frames when over maxReplayBytes", () => {
    const frames = [frame(1, 10), frame(2, 10), frame(3, 10)];
    const capped = capReplayTail(frames, { maxReplayFrames: 100, maxReplayBytes: 25 });
    expect(capped.map((r) => r.id)).toEqual([2, 3]);
  });
});
