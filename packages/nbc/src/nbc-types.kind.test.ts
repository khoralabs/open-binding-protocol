import { describe, expect, test } from "bun:test";
import { parseNbcTurnBody } from "./nbc-types";

describe("parseNbcPortSpec kind", () => {
  test("accepts kind", () => {
    const body = parseNbcTurnBody({
      offer: { id: "o", type: "step", expires_turn: 0 },
      ports: [
        {
          id: "p1",
          kind: "slot",
          promise: "pick",
          expires_turn: 0,
          bind_policy: null,
          ref: "",
        },
      ],
      bind_port_id: "",
      bind_payload: null,
    });
    expect(body.ports[0]?.kind).toBe("slot");
  });

  test("accepts legacy type when not a JSON Schema keyword", () => {
    const body = parseNbcTurnBody({
      offer: { id: "o", type: "step", expires_turn: 0 },
      ports: [
        {
          id: "p1",
          type: "slot",
          promise: "pick",
          expires_turn: 0,
          bind_policy: null,
          ref: "",
        },
      ],
      bind_port_id: "",
      bind_payload: null,
    });
    expect(body.ports[0]?.kind).toBe("slot");
  });

  test("rejects type that looks like JSON Schema", () => {
    expect(() =>
      parseNbcTurnBody({
        offer: { id: "o", type: "step", expires_turn: 0 },
        ports: [
          {
            id: "p1",
            type: "object",
            properties: {},
            promise: "",
            expires_turn: 0,
            bind_policy: null,
            ref: "",
          },
        ],
        bind_port_id: "",
        bind_payload: null,
      }),
    ).toThrow(/JSON Schema/);
  });

  test("does not default missing kind", () => {
    expect(() =>
      parseNbcTurnBody({
        offer: { id: "o", type: "step", expires_turn: 0 },
        ports: [
          {
            id: "p1",
            promise: "x",
            expires_turn: 0,
            bind_policy: null,
            ref: "",
          },
        ],
        bind_port_id: "",
        bind_payload: null,
      }),
    ).toThrow(/NbcPortSpec.kind/);
  });
});
