import { describe, expect, test } from "bun:test";
import { ObpError, toSha256HexLower } from "@khoralabs/obp-core";
import { encodeFramedJson } from "./encode-framed-json";
import { createFrameDecoder } from "./frame-decoder";
import { FrameType } from "./frame-protocol-types";
import { MAX_FRAME_BYTES } from "./length-prefix";

const gh = toSha256HexLower("d".repeat(64));
const ph = toSha256HexLower("e".repeat(64));

describe("createFrameDecoder", () => {
  test("decodes a complete negotiation frame", () => {
    const decoder = createFrameDecoder();
    const frame = {
      p_hash: ph,
      actor: "act",
      sig: "sig",
      type: FrameType.TURN,
      body: {},
    };
    const yields = decoder.push(encodeFramedJson(frame));
    expect(yields).toHaveLength(1);
    expect(yields[0]?.kind).toBe("frame");
  });

  test("reassembles a frame delivered in small chunks", () => {
    const decoder = createFrameDecoder();
    const frame = {
      p_hash: ph,
      actor: "act",
      sig: "sig",
      type: FrameType.TURN,
      body: {},
    };
    const bytes = encodeFramedJson(frame);
    const yields: ReturnType<typeof decoder.push> = [];
    for (const byte of bytes) {
      yields.push(...decoder.push(new Uint8Array([byte])));
    }
    expect(yields).toHaveLength(1);
    expect(yields[0]?.kind).toBe("frame");
  });

  test("rejects oversize length prefix before buffering payload", () => {
    const decoder = createFrameDecoder();
    const prefix = new Uint8Array(4);
    new DataView(prefix.buffer).setUint32(0, 0xffff_ffff, false);

    expect(() => decoder.push(prefix)).toThrow(ObpError);

    const frame = {
      p_hash: ph,
      actor: "act",
      sig: "sig",
      type: FrameType.TURN,
      body: {},
    };
    expect(decoder.push(encodeFramedJson(frame))).toHaveLength(1);
  });

  test("rejects declared frame larger than MAX_FRAME_BYTES", () => {
    const decoder = createFrameDecoder();
    const prefix = new Uint8Array(4);
    new DataView(prefix.buffer).setUint32(0, MAX_FRAME_BYTES + 1, false);

    expect(() => decoder.push(prefix)).toThrow(ObpError);
  });

  test("rejects aggregate decoder buffer above MAX_FRAME_BYTES + 4", () => {
    const decoder = createFrameDecoder();
    const prefix = new Uint8Array(4);
    new DataView(prefix.buffer).setUint32(0, MAX_FRAME_BYTES, false);
    decoder.push(prefix);

    expect(() => decoder.push(new Uint8Array(MAX_FRAME_BYTES + 1))).toThrow(ObpError);
  });

  test("accepts init envelope within max frame size", () => {
    const decoder = createFrameDecoder();
    const init = {
      init: {
        session_id: "sid",
        party_ids: ["p1", "p2"],
        actor_pubkeys: ["0x01", "0x02"],
        genesis_hash: gh,
      },
    };
    const yields = decoder.push(encodeFramedJson(init));
    expect(yields).toHaveLength(1);
    expect(yields[0]?.kind).toBe("init");
  });
});
