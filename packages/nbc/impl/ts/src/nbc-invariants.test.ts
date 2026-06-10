import { describe, expect, test } from "bun:test";
import { validateNbcBindPayloadForPort } from "@khoralabs/nbc-bind-policy";
import type { JsonDocument, Offer, Port } from "@khoralabs/obp-model";
import { validateNbcBind } from "./nbc-invariants";
import { resolveCanonicalPortId } from "./nbc-ref";

function nbcBindValidate(
  bindPolicy: JsonDocument | null,
  bindPayload: JsonDocument | null,
): JsonDocument {
  return validateNbcBindPayloadForPort(bindPolicy, bindPayload) as JsonDocument;
}

const textBindSchema = {
  type: "object" as const,
  additionalProperties: false,
  required: ["greeting"],
  properties: {
    greeting: {
      type: "string" as const,
      minLength: 1,
      description: "A short hello",
    },
  },
};

const basePortFields = { type: "t" as const, promise: "" as const };

const win = (turn: number, relay: number) => ({
  nbc_expires_turn: turn,
  nbc_expires_at_relay_ms: relay,
});

const bindCap = {
  existingBinds: [] as { portId: string }[],
  max_bindings: 1,
};

describe("resolveCanonicalPortId", () => {
  test("resolves empty ref", () => {
    const p: Port = {
      id: "a",
      ...basePortFields,
      ref: "",
    };
    const m = new Map<string, Port>([["a", p]]);
    expect(resolveCanonicalPortId(m, "a")).toEqual({
      ok: true,
      canonicalId: "a",
      path: ["a"],
    });
  });

  test("detects cycle", () => {
    const a: Port = {
      id: "a",
      ...basePortFields,
      ref: "b",
    };
    const b: Port = {
      id: "b",
      ...basePortFields,
      ref: "a",
    };
    const m = new Map<string, Port>([
      ["a", a],
      ["b", b],
    ]);
    const r = resolveCanonicalPortId(m, "a");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cycle");
  });
});

describe("validateNbcBind", () => {
  const offer: Offer = {
    id: "o1",
    type: "step",
  };
  const port: Port = {
    id: "p1",
    type: "slot",
    promise: "x",
    ref: "",
  };
  const ports = new Map<string, Port>([["p1", port]]);

  test("N1 rejects expired offer (turn)", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 50, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(50, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: null,
      bindPayload: null,
      ...bindCap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toEqual({ code: "EXPIRED", entity: "offer" });
  });

  test("N1 skips when both expiry modes off", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 999, relayTsMs: 999 },
      offer,
      port,
      offerBindWindow: win(0, 0),
      portBindWindow: win(0, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: null,
      bindPayload: null,
      ...bindCap,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalizedBindPayload).toBeNull();
  });

  test("N1 rejects relay expiry without relay ts", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 0 },
      offer,
      port,
      offerBindWindow: win(0, 100),
      portBindWindow: win(0, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: null,
      bindPayload: null,
      ...bindCap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toEqual({ code: "EXPIRED", entity: "offer" });
  });

  test("NOT_EXPOSED", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: false,
      bindPolicy: null,
      bindPayload: null,
      ...bindCap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toEqual({ code: "NOT_EXPOSED" });
  });

  test("N2 rejects when canonical bind cap reached", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: null,
      bindPayload: null,
      existingBinds: [{ portId: "p1" }],
      max_bindings: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure).toEqual({
        code: "MAX_BINDINGS_EXCEEDED",
        canonicalPortId: "p1",
        max_bindings: 1,
      });
    }
  });

  test("N2 counts ref alias toward canonical cap", async () => {
    const canonical: Port = { id: "a", type: "t", promise: "", ref: "" };
    const alias: Port = { id: "b", type: "t", promise: "", ref: "a" };
    const aliasPorts = new Map<string, Port>([
      ["a", canonical],
      ["b", alias],
    ]);
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port: alias,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: aliasPorts,
      targetPortIsExposed: true,
      bindPolicy: null,
      bindPayload: null,
      existingBinds: [{ portId: "b" }],
      max_bindings: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.code).toBe("MAX_BINDINGS_EXCEEDED");
  });

  test("N4 rejects bind_payload when no policy", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: null,
      bindPayload: { x: 1 },
      ...bindCap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.code).toBe("POLICY_REJECTED");
  });

  test("N4 rejects invalid policy document (host validator)", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: { required: true },
      bindPayload: { ok: true },
      validateBindPayload: nbcBindValidate,
      ...bindCap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.code).toBe("POLICY_REJECTED");
  });

  test("N4 rejects active bind_policy without host validator", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: textBindSchema,
      bindPayload: { greeting: "yo" },
      ...bindCap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure.code).toBe("POLICY_REJECTED");
      expect(String("reason" in r.failure ? r.failure.reason : "")).toContain(
        "validateBindPayload",
      );
    }
  });

  test("N4 success with schema bind_payload", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: textBindSchema,
      bindPayload: { greeting: "yo" },
      validateBindPayload: nbcBindValidate,
      ...bindCap,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.normalizedBindPayload).toEqual({ greeting: "yo" });
  });

  test("N4 rejects missing required field", async () => {
    const r = await validateNbcBind({
      timing: { turnSeq: 0, relayTsMs: 1 },
      offer,
      port,
      offerBindWindow: win(100, 0),
      portBindWindow: win(100, 0),
      portsById: ports,
      targetPortIsExposed: true,
      bindPolicy: textBindSchema,
      bindPayload: {},
      validateBindPayload: nbcBindValidate,
      ...bindCap,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure.code).toBe("POLICY_REJECTED");
  });
});
