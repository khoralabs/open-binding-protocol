import { describe, expect, test } from "bun:test";
import { createMemoryDuplexByteStreamPair } from "./duplex-byte-stream";
import { createWebSocketDuplexByteStream } from "./ws-channel";

describe("bounded inbound queue", () => {
  test("memory pair closes when inbound queue exceeds max depth", async () => {
    const [writer, reader] = createMemoryDuplexByteStreamPair({ maxInboundQueueDepth: 2 });

    await writer.write(new Uint8Array([1]));
    await writer.write(new Uint8Array([2]));
    await writer.write(new Uint8Array([3]));

    const chunks: number[] = [];
    for await (const c of reader.read()) {
      chunks.push(c[0] ?? -1);
    }

    expect(chunks).toEqual([1, 2]);
    await writer.write(new Uint8Array([4]));
    const afterClose: Uint8Array[] = [];
    for await (const c of reader.read()) {
      afterClose.push(c);
    }
    expect(afterClose).toHaveLength(0);
  });

  test("websocket adapter closes when inbound queue exceeds max depth", async () => {
    const { channel, onMessage } = createWebSocketDuplexByteStream(() => {}, {
      maxInboundQueueDepth: 2,
    });

    onMessage(new Uint8Array([1]));
    onMessage(new Uint8Array([2]));
    onMessage(new Uint8Array([3]));

    const chunks: number[] = [];
    for await (const c of channel.read()) {
      chunks.push(c[0] ?? -1);
    }

    expect(chunks).toEqual([1, 2]);
    onMessage(new Uint8Array([4]));
    const afterClose: Uint8Array[] = [];
    for await (const c of channel.read()) {
      afterClose.push(c);
    }
    expect(afterClose).toHaveLength(0);
  });
});
