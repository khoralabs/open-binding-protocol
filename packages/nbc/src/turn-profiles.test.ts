import { describe, expect, test } from "bun:test";
import {
  continueTurnSchemaForPorts,
  hostTurnToNbcBody,
  leaveTurnSchema,
  openingTurnSchema,
} from "./turn-profiles";

describe("turn profiles", () => {
  test("opening requires expose and kind+promise", () => {
    const bad = openingTurnSchema["~standard"].validate({ expose: [] });
    expect("issues" in bad && bad.issues).toBeTruthy();
    const ok = openingTurnSchema["~standard"].validate({
      expose: [{ kind: "slot", promise: "pick" }],
    });
    expect("value" in ok).toBe(true);
    if ("value" in ok) {
      const wire = hostTurnToNbcBody(ok.value, "opening");
      expect(wire.ports[0]?.kind).toBe("slot");
      expect(wire.bind_port_id).toBe("");
      expect(wire.offer.expires_at_ms).toBe(0);
    }
  });

  test("continue requires bind and inlines empty payload schema", () => {
    const schema = continueTurnSchemaForPorts([{ id: "p1", bind_policy: null }]);
    const extra = schema["~standard"].validate({
      bind: { portId: "p1", payload: { x: 1 } },
    });
    expect("issues" in extra && extra.issues).toBeTruthy();
    const ok = schema["~standard"].validate({ bind: { portId: "p1", payload: {} } });
    expect("value" in ok).toBe(true);
  });

  test("continue omitted payload fails when bind_policy is required", () => {
    const policy = {
      type: "object" as const,
      additionalProperties: false,
      required: ["greeting"],
      properties: {
        greeting: { type: "string" as const, minLength: 1 },
      },
    };
    const schema = continueTurnSchemaForPorts([{ id: "p1", bind_policy: policy }]);
    const omitted = schema["~standard"].validate({ bind: { portId: "p1" } });
    expect("issues" in omitted && omitted.issues).toBeTruthy();
    const empty = schema["~standard"].validate({ bind: { portId: "p1", payload: {} } });
    expect("issues" in empty && empty.issues).toBeTruthy();
    const ok = schema["~standard"].validate({
      bind: { portId: "p1", payload: { greeting: "hi" } },
    });
    expect("value" in ok).toBe(true);
  });

  test("leave is disconnect true", () => {
    const ok = leaveTurnSchema["~standard"].validate({ disconnect: true });
    expect("value" in ok).toBe(true);
    const json = leaveTurnSchema["~standard"].jsonSchema.input({ target: "draft-2020-12" });
    expect(json.required).toEqual(["disconnect"]);
  });
});
