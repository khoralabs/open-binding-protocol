import type { RelayedFrameRecord } from "./store-types";

export type FrameRelaySpoolLimits = {
  maxFramesPerChannel: number;
  maxBytesPerChannel: number;
  maxReplayFrames: number;
  maxReplayBytes: number;
};

export const DEFAULT_FRAME_RELAY_SPOOL_LIMITS: FrameRelaySpoolLimits = {
  maxFramesPerChannel: 1024,
  maxBytesPerChannel: 16 * 1024 * 1024,
  maxReplayFrames: 1024,
  maxReplayBytes: 8 * 1024 * 1024,
};

function totalBytes(frames: readonly RelayedFrameRecord[]): number {
  let n = 0;
  for (const row of frames) {
    n += row.bytes.byteLength;
  }
  return n;
}

/** Drop oldest spool rows until within per-channel frame and byte budgets (ring buffer). */
export function trimSpoolToLimits(
  frames: RelayedFrameRecord[],
  limits: Pick<FrameRelaySpoolLimits, "maxFramesPerChannel" | "maxBytesPerChannel">,
): RelayedFrameRecord[] {
  const out = [...frames];
  while (out.length > limits.maxFramesPerChannel) {
    out.shift();
  }
  while (out.length > 0 && totalBytes(out) > limits.maxBytesPerChannel) {
    out.shift();
  }
  return out;
}

/** When replay exceeds caps, keep the most recent tail (preserves order). */
export function capReplayTail(
  frames: readonly RelayedFrameRecord[],
  limits: Pick<FrameRelaySpoolLimits, "maxReplayFrames" | "maxReplayBytes">,
): RelayedFrameRecord[] {
  const tail: RelayedFrameRecord[] = [];
  let bytes = 0;
  for (let i = frames.length - 1; i >= 0; i--) {
    const row = frames[i];
    if (row === undefined) continue;
    if (tail.length >= limits.maxReplayFrames) break;
    const nextBytes = bytes + row.bytes.byteLength;
    if (tail.length > 0 && nextBytes > limits.maxReplayBytes) break;
    tail.unshift(row);
    bytes = nextBytes;
  }
  return tail;
}
