import { describe, expect, test } from "bun:test";
import { bindPayloadSchemaForPort } from "./bind-payload-schema";

const greetingPolicy = {
  type: "object" as const,
  additionalProperties: false,
  required: ["greeting"],
  properties: {
    greeting: { type: "string" as const, minLength: 1 },
  },
};

describe("bindPayloadSchemaForPort", () => {
  test("inactive policy rejects extra keys", () => {
    const schema = bindPayloadSchemaForPort({ id: "p1", bind_policy: null });
    const bad = schema["~standard"].validate({ x: 1 });
    expect("issues" in bad && bad.issues).toBeTruthy();
    const ok = schema["~standard"].validate({});
    expect("value" in ok).toBe(true);
  });

  test("active policy rejects payloads that fail JSON Schema", () => {
    const schema = bindPayloadSchemaForPort({ id: "p1", bind_policy: greetingPolicy });
    const empty = schema["~standard"].validate({});
    expect("issues" in empty && empty.issues).toBeTruthy();
    const ok = schema["~standard"].validate({ greeting: "hi" });
    expect("value" in ok).toBe(true);
    if ("value" in ok) expect(ok.value).toEqual({ greeting: "hi" });
  });
});
