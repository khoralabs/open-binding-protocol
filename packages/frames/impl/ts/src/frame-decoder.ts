import { ObpError } from "@khoralabs/obp-errors";
import { canonicalJsonString } from "./canonical-json";
import { encodeFramedJson } from "./encode-framed-json";
import type { Frame, SessionEnvelopeWire } from "./frame-protocol-types";
import { MAX_FRAME_BYTES } from "./length-prefix";

const MAX_DECODER_BUFFER_BYTES = MAX_FRAME_BYTES + 4;

export type FrameDecoderYield =
  | { kind: "init"; value: unknown }
  | { kind: "frame"; value: Frame; wireUtf8: string }
  | { kind: "session_envelope"; value: SessionEnvelopeWire }
  | { kind: "raw"; value: unknown };

export function createFrameDecoder(): {
  push(chunk: Uint8Array): FrameDecoderYield[];
  reset(): void;
} {
  let buf = new Uint8Array(256);
  let used = 0;

  const resetBuffer = (): void => {
    buf = new Uint8Array(256);
    used = 0;
  };

  const fail = (message: string): never => {
    resetBuffer();
    throw new ObpError("VALIDATION", message);
  };

  const declaredPayloadLen = (): number => {
    return new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0, false);
  };

  const rejectOversizePrefix = (len: number): void => {
    if (len > MAX_FRAME_BYTES) {
      fail("frame length prefix exceeds MAX_FRAME_BYTES");
    }
  };

  const append = (chunk: Uint8Array): void => {
    if (chunk.length > MAX_DECODER_BUFFER_BYTES) {
      fail("frame chunk exceeds max decoder buffer");
    }
    const needed = used + chunk.length;
    if (needed > MAX_DECODER_BUFFER_BYTES) {
      fail("decoder buffer exceeds max frame size");
    }
    if (used >= 4) {
      rejectOversizePrefix(declaredPayloadLen());
    }
    if (needed > buf.length) {
      const nextCap = Math.min(MAX_DECODER_BUFFER_BYTES, Math.max(buf.length * 2, needed));
      const next = new Uint8Array(nextCap);
      next.set(buf.subarray(0, used));
      buf = next;
    }
    buf.set(chunk, used);
    used += chunk.length;
    if (used >= 4) {
      rejectOversizePrefix(declaredPayloadLen());
    }
  };

  const tryParseOne = (): FrameDecoderYield | null => {
    if (used < 4) return null;
    const len = declaredPayloadLen();
    rejectOversizePrefix(len);
    if (used < 4 + len) return null;
    const jsonBytes = buf.subarray(4, 4 + len);
    const remain = used - (4 + len);
    if (remain > 0) {
      const next = new Uint8Array(Math.max(256, remain));
      next.set(buf.subarray(4 + len, used));
      buf = next;
      used = remain;
    } else {
      resetBuffer();
    }
    const text = new TextDecoder().decode(jsonBytes);
    const value = JSON.parse(text) as unknown;
    if (isRecord(value) && "init" in value) {
      return { kind: "init", value };
    }
    if (isNegotiationFrameObject(value)) {
      return { kind: "frame", value: value as Frame, wireUtf8: canonicalJsonString(value) };
    }
    if (isSessionEnvelopeMessage(value)) {
      return { kind: "session_envelope", value: value.session_envelope };
    }
    return { kind: "raw", value };
  };

  return {
    push(chunk: Uint8Array): FrameDecoderYield[] {
      append(chunk);
      const out: FrameDecoderYield[] = [];
      for (;;) {
        const one = tryParseOne();
        if (one === null) break;
        out.push(one);
      }
      return out;
    },
    reset(): void {
      resetBuffer();
    },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** True when **`v`** matches normative **`Frame`** JSON keys (for relay wrap / decode). */
export function isNegotiationFrameObject(v: unknown): v is Frame {
  if (!isRecord(v)) return false;
  return (
    typeof v.p_hash === "string" &&
    typeof v.actor === "string" &&
    typeof v.sig === "string" &&
    typeof v.type === "string" &&
    typeof v.body === "object" &&
    v.body !== null &&
    !Array.isArray(v.body)
  );
}

function isCheckpointRecord(v: unknown): v is SessionEnvelopeWire["base_checkpoint"] {
  return isRecord(v) && typeof v.seq === "number" && typeof v.root_hex === "string";
}

function isSessionEnvelopeMessage(v: unknown): v is { session_envelope: SessionEnvelopeWire } {
  if (!isRecord(v) || !("session_envelope" in v)) return false;
  const e = v.session_envelope;
  if (!isRecord(e)) return false;
  if (typeof e.session_id !== "string" || typeof e.from_party !== "string") return false;
  if (!isCheckpointRecord(e.base_checkpoint) || !isCheckpointRecord(e.new_checkpoint)) return false;
  return Array.isArray(e.delta_ops);
}

export function encodeSessionEnvelopeMessage(envelope: SessionEnvelopeWire): Uint8Array {
  return encodeFramedJson({ session_envelope: envelope });
}
