import { describe, expect, test } from "bun:test";
import { decodeMlsHubEnvelope, encodeMlsHubEnvelope } from "./mls-hub-envelope";

describe("mls-hub-envelope", () => {
  test("round-trip", () => {
    const wire = encodeMlsHubEnvelope("gid", "YWJj");
    const decoded = decodeMlsHubEnvelope(wire);
    expect(decoded?.groupId).toBe("gid");
    expect(decoded?.payloadBase64Url).toBe("YWJj");
  });
});
