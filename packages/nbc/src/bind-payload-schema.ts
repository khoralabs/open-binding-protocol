/**
 * Standard Schema for a port's bind_payload (empty object when policy is inactive).
 */

import type { JsonDocument } from "@khoralabs/obp-core";
import { ObpError } from "@khoralabs/obp-core";
import { validateNbcBindPayloadForPort } from "./bind-policy/validate-bind-payload";
import { isActiveBindPolicy } from "./nbc-invariants";
import {
  createObpStandardSchema,
  isRecord,
  issue,
  type ObpStandardSchema,
} from "./standard-schema";

const EMPTY_OBJECT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

function inactivePayloadSchema(): ObpStandardSchema<Record<string, never>> {
  return createObpStandardSchema(EMPTY_OBJECT_SCHEMA, (value) => {
    if (value === undefined || value === null) {
      return { value: {} };
    }
    if (!isRecord(value) || Object.keys(value).length > 0) {
      return issue("bind_payload must be omitted or empty when port has no bind_policy");
    }
    return { value: {} };
  });
}

/**
 * LLM / host schema for **`bind_payload`** on a given port.
 * Inactive policy ⇒ `{}` + `additionalProperties: false`.
 * Active policy ⇒ the port's JSON Schema `bind_policy` (AJV + jsonSchema).
 */
export function bindPayloadSchemaForPort(port: {
  readonly id?: string;
  readonly bind_policy?: JsonDocument | null;
}): ObpStandardSchema<Record<string, unknown>> {
  const policy = port.bind_policy ?? null;
  if (!isActiveBindPolicy(policy)) {
    return inactivePayloadSchema() as ObpStandardSchema<Record<string, unknown>>;
  }
  const jsonSchema =
    typeof policy === "object" && policy !== null && !Array.isArray(policy)
      ? (policy as Record<string, unknown>)
      : EMPTY_OBJECT_SCHEMA;
  const portId = port.id ?? "";
  return createObpStandardSchema(jsonSchema, (value) => {
    try {
      const normalized = validateNbcBindPayloadForPort(policy, value, portId);
      return { value: normalized };
    } catch (e) {
      const msg = e instanceof ObpError || e instanceof Error ? e.message : String(e);
      return issue(
        portId.length > 0 ? `bind_payload for port ${portId}: ${msg}` : `bind_payload: ${msg}`,
      );
    }
  });
}
