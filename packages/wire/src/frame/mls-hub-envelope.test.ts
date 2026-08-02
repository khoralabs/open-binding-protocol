import { describe, expect, test } from "bun:test";
import { decodeMlsHubEnvelope, encodeMlsHubEnvelope } from "./mls-hub-envelope";

describe("mls-hub-envelope", () => {
  test("round-trip", () => {
    const wire = encodeMlsHubEnvelope("opaque-route", "YWJj");
    const decoded = decodeMlsHubEnvelope(wire);
    expect(decoded?.route).toBe("opaque-route");
    expect(decoded?.payloadBase64Url).toBe("YWJj");
  });
});
