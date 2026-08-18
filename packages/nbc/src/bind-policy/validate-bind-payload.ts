import type { JsonDocument } from "@khoralabs/obp-core";
import { ObpError } from "@khoralabs/obp-core";

import { assertBindPolicyJsonSchema, getBindPayloadValidator } from "./ajv-compile-bind-schema";
import { formatAjvErrorsForAgent } from "./format-ajv-errors";

export function policyIsActive(bindPolicy: JsonDocument | null): boolean {
  return (
    bindPolicy !== null &&
    typeof bindPolicy === "object" &&
    !Array.isArray(bindPolicy) &&
    Object.keys(bindPolicy as object).length > 0
  );
}

function isEmptyBindPayload(raw: unknown): boolean {
  if (raw === undefined || raw === null) {
    return true;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  return Object.keys(raw as object).length === 0;
}

/**
 * Compile-check an active **`bind_policy`** at expose time (strict JSON Schema draft 2020-12).
 * @throws {ObpError} **`VALIDATION`** when the schema is ill-formed or uses unknown keywords.
 */
export function validateBindPolicyAtExpose(bindPolicy: JsonDocument | null): void {
  if (!policyIsActive(bindPolicy)) {
    return;
  }
  assertBindPolicyJsonSchema(bindPolicy);
  getBindPayloadValidator(bindPolicy);
}

/**
 * Validates **`bind_payload`** against **`bind_policy`** when the policy is present and non-empty.
 * **`bind_policy`** MUST be a JSON Schema (draft 2020-12) with root **`type`: `"object"`**.
 * Returns a normalized plain JSON object for persistence.
 * @throws {ObpError} **`VALIDATION`** on mismatch or invalid schema.
 */
export function validateNbcBindPayloadForPort(
  bindPolicy: JsonDocument | null,
  raw: unknown,
  portId?: string,
): Record<string, unknown> {
  if (!policyIsActive(bindPolicy)) {
    if (!isEmptyBindPayload(raw)) {
      throw new ObpError(
        "VALIDATION",
        portId !== undefined && portId.length > 0
          ? `bind_payload must be omitted or empty when port ${portId} has no bind_policy`
          : "bind_payload must be omitted or empty when port has no bind_policy",
      );
    }
    return {};
  }

  assertBindPolicyJsonSchema(bindPolicy);
  const validate = getBindPayloadValidator(bindPolicy);

  if (!validate(raw)) {
    throw new ObpError("VALIDATION", `bind_payload:\n${formatAjvErrorsForAgent(validate.errors)}`);
  }

  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
}
