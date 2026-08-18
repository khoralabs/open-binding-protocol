import { describe, expect, test } from "bun:test";
import { validateNbcBindPayloadForPort } from "./validate-bind-payload";

const greetingSchema = {
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

describe("validateNbcBindPayloadForPort", () => {
  test("rejects payload without policy", () => {
    expect(validateNbcBindPayloadForPort(null, {})).toEqual({});
    expect(() => validateNbcBindPayloadForPort(null, { x: 1 }, "port-z")).toThrow(/port port-z/);
  });

  test("validates against bind_policy JSON Schema", () => {
    expect(validateNbcBindPayloadForPort(greetingSchema, { greeting: "yo" })).toEqual({
      greeting: "yo",
    });
    expect(() => validateNbcBindPayloadForPort(greetingSchema, {})).toThrow();
  });
});
