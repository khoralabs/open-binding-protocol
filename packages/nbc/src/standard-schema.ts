/**
 * Hand-written Standard Schema + Standard JSON Schema objects (vendor `obp-nbc`).
 * Hosts consume `~standard.validate` and `~standard.jsonSchema` — not Zod.
 */

import type { StandardJSONSchemaV1, StandardSchemaV1 } from "@standard-schema/spec";

export type ObpStandardSchema<Input = unknown, Output = Input> = StandardSchemaV1<Input, Output> & {
  readonly "~standard": StandardSchemaV1.Props<Input, Output> &
    Pick<StandardJSONSchemaV1<Input, Output>["~standard"], "jsonSchema">;
};

export function createObpStandardSchema<T>(
  jsonSchema: Record<string, unknown>,
  validate: (value: unknown) => StandardSchemaV1.Result<T>,
): ObpStandardSchema<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "obp-nbc",
      validate,
      jsonSchema: {
        input: () => jsonSchema,
        output: () => jsonSchema,
      },
    },
  } as ObpStandardSchema<T>;
}

export function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function issue(
  message: string,
  path?: ReadonlyArray<PropertyKey>,
): StandardSchemaV1.FailureResult {
  return {
    issues: [{ message, ...(path !== undefined ? { path: [...path] } : {}) }],
  };
}
