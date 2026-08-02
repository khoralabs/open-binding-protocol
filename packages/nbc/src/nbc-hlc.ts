/**
 * Hybrid Logical Clock utilities for NBC peer epoch timing.
 * Algorithm: Kulkarni & Demirbas 2014. Skew: RFC 5905 §8 one-way adaptation.
 */

export type HlcTimestamp = { pt: number; lc: number };
export type HlcState = { pt: number; lc: number };

export type ClockObservation = {
  p_hash: string;
  peer_actor: string;
  peer_pt: number;
  recv_ms: number;
};

export type ClockBlock = {
  hlc: HlcTimestamp;
  observed?: ClockObservation;
};

export const HLC_MIN_SAMPLES = 1;
export const HLC_MAX_SKEW_MS = 30_000;

export function createHlcState(wallMs = Date.now()): HlcState {
  return { pt: wallMs, lc: 0 };
}

export function sendHlc(state: HlcState, wallMs: number): HlcTimestamp {
  const pt = Math.max(state.pt, wallMs);
  const lc = pt === state.pt ? state.lc + 1 : 0;
  state.pt = pt;
  state.lc = lc;
  return { pt, lc };
}

export function recvHlc(state: HlcState, msgHlc: HlcTimestamp, wallMs: number): void {
  const pt = Math.max(state.pt, msgHlc.pt, wallMs);
  let lc = 0;
  if (pt === state.pt && pt === msgHlc.pt) {
    lc = Math.max(state.lc, msgHlc.lc) + 1;
  } else if (pt === state.pt) {
    lc = state.lc + 1;
  } else if (pt === msgHlc.pt) {
    lc = msgHlc.lc + 1;
  }
  state.pt = pt;
  state.lc = lc;
}

export function hlcPhysicalNow(state: HlcState, wallMs: number): number {
  return Math.max(state.pt, wallMs);
}

export function estimateSkewMs(
  samples: ReadonlyArray<{ peer_pt: number; recv_ms: number }>,
): { offsetMs: number; count: number } | null {
  if (samples.length < HLC_MIN_SAMPLES) return null;
  let sum = 0;
  for (const s of samples) {
    sum += s.recv_ms - s.peer_pt;
  }
  return { offsetMs: sum / samples.length, count: samples.length };
}

export function conservativeEffectiveNow(
  state: HlcState,
  wallMs: number,
  samples: ReadonlyArray<{ peer_pt: number; recv_ms: number }>,
  opts?: { maxSkewMs?: number; minSamples?: number },
): number | null {
  const maxSkewMs = opts?.maxSkewMs ?? HLC_MAX_SKEW_MS;
  const minSamples = opts?.minSamples ?? HLC_MIN_SAMPLES;
  const skew = estimateSkewMs(samples);
  if (skew === null || skew.count < minSamples) return null;
  if (Math.abs(skew.offsetMs) > maxSkewMs) return null;
  const hlcNow = hlcPhysicalNow(state, wallMs);
  return Math.max(hlcNow, wallMs + skew.offsetMs);
}
