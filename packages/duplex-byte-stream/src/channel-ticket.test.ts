import { describe, expect, test } from "bun:test";
import { generateChannelSecretHex, signChannelTicket, verifyChannelTicket } from "./channel-ticket";

describe("channel-ticket", () => {
  test("round trip", async () => {
    const secret = generateChannelSecretHex();
    const channelId = "sess-abc-123";
    const ticket = await signChannelTicket(channelId, secret);
    expect(await verifyChannelTicket(channelId, ticket, secret)).toBe(true);
    expect(await verifyChannelTicket("other", ticket, secret)).toBe(false);
  });

  test("rejects prefix channelId mismatch", async () => {
    const secret = generateChannelSecretHex();
    const channelId = "sess-abc-123";
    const ticket = await signChannelTicket(channelId, secret);
    expect(await verifyChannelTicket("sess-abc", ticket, secret)).toBe(false);
    expect(await verifyChannelTicket("sess-abc-1234", ticket, secret)).toBe(false);
  });
});
