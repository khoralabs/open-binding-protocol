/**
 * Host-facing NBC turn profiles (opening / continue / leave) as Standard Schema.
 * Wire remains {@link NbcTurnBody} (`ports` / `bind_port_id`).
 */

import type { JsonDocument } from "@khoralabs/obp-core";
import { bindPayloadSchemaForPort } from "./bind-payload-schema";
import type { NbcPortSpec, NbcTurnBody } from "./nbc-types";
import {
  createObpStandardSchema,
  isRecord,
  issue,
  type ObpStandardSchema,
} from "./standard-schema";

export type OpeningPort = {
  id?: string;
  kind: string;
  promise: string;
  expires_turn?: number;
  expires_at_ms?: number;
  bind_policy?: JsonDocument | null;
  ref?: string;
  max_bindings?: number;
  terminal?: boolean;
};

export type OpeningTurn = {
  expose: OpeningPort[];
};

export type ContinueTurn = {
  bind: { portId: string; payload?: Record<string, unknown> };
  expose?: OpeningPort[];
};

export type LeaveTurn = {
  disconnect: true;
};

export type HostTurnBody = OpeningTurn | ContinueTurn | LeaveTurn;

const PORT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "promise"],
  properties: {
    id: { type: "string" },
    kind: { type: "string", minLength: 1 },
    promise: { type: "string", minLength: 1 },
    expires_turn: { type: "integer", minimum: 0 },
    expires_at_ms: { type: "integer", minimum: 0 },
    bind_policy: { type: ["object", "null"] },
    ref: { type: "string" },
    max_bindings: { type: "integer", minimum: 1 },
    terminal: { type: "boolean" },
  },
};

function parseNonnegInt(v: unknown, field: string): number | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new TypeError(`${field}: expected non-negative integer`);
  }
  return v;
}

function parseOpeningPort(raw: unknown, index: number): OpeningPort | { issues: string } {
  if (!isRecord(raw)) return { issues: `expose[${index}]: expected object` };
  if (typeof raw.kind !== "string" || raw.kind.length === 0) {
    return { issues: `expose[${index}].kind: required non-empty string` };
  }
  if (typeof raw.promise !== "string" || raw.promise.length === 0) {
    return { issues: `expose[${index}].promise: required non-empty string` };
  }
  let expires_turn: number | undefined;
  let expires_at_ms: number | undefined;
  try {
    expires_turn = parseNonnegInt(raw.expires_turn, `expose[${index}].expires_turn`);
    expires_at_ms = parseNonnegInt(raw.expires_at_ms, `expose[${index}].expires_at_ms`);
  } catch (e) {
    return { issues: e instanceof Error ? e.message : String(e) };
  }
  const port: OpeningPort = {
    kind: raw.kind,
    promise: raw.promise,
    ...(typeof raw.id === "string" ? { id: raw.id } : {}),
    ...(expires_turn !== undefined ? { expires_turn } : {}),
    ...(expires_at_ms !== undefined ? { expires_at_ms } : {}),
    ...("bind_policy" in raw
      ? { bind_policy: (raw.bind_policy ?? null) as JsonDocument | null }
      : {}),
    ...(typeof raw.ref === "string" ? { ref: raw.ref } : {}),
    ...(typeof raw.max_bindings === "number" ? { max_bindings: raw.max_bindings } : {}),
    ...(typeof raw.terminal === "boolean" ? { terminal: raw.terminal } : {}),
  };
  return port;
}

const OPENING_JSON: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["expose"],
  properties: {
    expose: { type: "array", minItems: 1, items: PORT_JSON_SCHEMA },
  },
};

const LEAVE_JSON: Record<string, unknown> = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["disconnect"],
  properties: {
    disconnect: { const: true },
  },
};

export const openingTurnSchema: ObpStandardSchema<OpeningTurn> = createObpStandardSchema(
  OPENING_JSON,
  (value) => {
    if (!isRecord(value)) return issue("opening turn: expected object");
    if (!Array.isArray(value.expose) || value.expose.length < 1) {
      return issue("opening turn: expose requires at least one port");
    }
    if ("bind" in value || "disconnect" in value) {
      return issue("opening turn: must not include bind or disconnect");
    }
    const expose: OpeningPort[] = [];
    for (let i = 0; i < value.expose.length; i++) {
      const p = parseOpeningPort(value.expose[i], i);
      if ("issues" in p) return issue(p.issues);
      expose.push(p);
    }
    return { value: { expose } };
  },
);

export const leaveTurnSchema: ObpStandardSchema<LeaveTurn> = createObpStandardSchema(
  LEAVE_JSON,
  (value) => {
    if (!isRecord(value)) return issue("leave turn: expected object");
    if (value.disconnect !== true) return issue("leave turn: disconnect must be true");
    return { value: { disconnect: true as const } };
  },
);

function continueJsonSchema(
  ports: readonly { id: string; bind_policy?: JsonDocument | null }[],
): Record<string, unknown> {
  const payloadSchemas = ports.map((p) =>
    bindPayloadSchemaForPort(p)["~standard"].jsonSchema.input({
      target: "draft-2020-12",
    }),
  );
  const oneOf =
    ports.length === 0
      ? [
          {
            type: "object",
            additionalProperties: false,
            required: ["portId"],
            properties: {
              portId: { type: "string", minLength: 1 },
              payload: { type: "object" },
            },
          },
        ]
      : ports.map((p, i) => ({
          type: "object",
          additionalProperties: false,
          required: ["portId"],
          properties: {
            portId: { const: p.id },
            payload: payloadSchemas[i],
          },
        }));
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["bind"],
    properties: {
      bind: { oneOf },
      expose: { type: "array", items: PORT_JSON_SCHEMA },
    },
  };
}

/** Continue schema with per-port `bind_policy` inlined for `Output.object`. */
export function continueTurnSchemaForPorts(
  ports: readonly { id: string; bind_policy?: JsonDocument | null }[],
): ObpStandardSchema<ContinueTurn> {
  const allowed = new Set(ports.map((p) => p.id));
  const byId = new Map(ports.map((p) => [p.id, p]));
  return createObpStandardSchema(continueJsonSchema(ports), (value) => {
    if (!isRecord(value)) return issue("continue turn: expected object");
    if (value.disconnect === true) return issue("continue turn: use leave profile for disconnect");
    if (
      !isRecord(value.bind) ||
      typeof value.bind.portId !== "string" ||
      value.bind.portId.length === 0
    ) {
      return issue("continue turn: bind.portId is required");
    }
    const portId = value.bind.portId;
    if (allowed.size > 0 && !allowed.has(portId)) {
      return issue(`continue turn: port ${portId} is not bindable`);
    }
    const port = byId.get(portId);
    const schema = bindPayloadSchemaForPort(port ?? { id: portId, bind_policy: null });
    const result = schema["~standard"].validate(value.bind.payload);
    if (result instanceof Promise) {
      return issue("continue turn: bind payload schema must be sync");
    }
    if (result.issues) {
      return { issues: result.issues };
    }
    const payload = result.value;
    let expose: OpeningPort[] | undefined;
    if (value.expose !== undefined) {
      if (!Array.isArray(value.expose)) return issue("continue turn: expose must be an array");
      expose = [];
      for (let i = 0; i < value.expose.length; i++) {
        const p = parseOpeningPort(value.expose[i], i);
        if ("issues" in p) return issue(p.issues);
        expose.push(p);
      }
    }
    return {
      value: {
        bind: { portId, payload },
        ...(expose !== undefined ? { expose } : {}),
      },
    };
  });
}

const DEFAULT_CONTINUE = continueTurnSchemaForPorts([]);

export const continueTurnSchema: ObpStandardSchema<ContinueTurn> = DEFAULT_CONTINUE;

function openingPortToSpec(p: OpeningPort): NbcPortSpec {
  return {
    id: p.id ?? "",
    kind: p.kind,
    promise: p.promise,
    expires_turn: p.expires_turn ?? 0,
    expires_at_ms: p.expires_at_ms ?? 0,
    bind_policy: p.bind_policy ?? null,
    ref: p.ref ?? "",
    ...(p.max_bindings !== undefined ? { max_bindings: p.max_bindings } : {}),
    ...(p.terminal !== undefined ? { terminal: p.terminal } : {}),
  };
}

export function isLeaveTurn(body: HostTurnBody): body is LeaveTurn {
  return "disconnect" in body && body.disconnect === true;
}

export function isContinueTurn(body: HostTurnBody): body is ContinueTurn {
  return "bind" in body && !isLeaveTurn(body);
}

export function isOpeningTurn(body: HostTurnBody): body is OpeningTurn {
  return "expose" in body && !("bind" in body) && !isLeaveTurn(body);
}

/** Map a validated host profile to NBC wire (not used for leave — that is END_OFFERS). */
export function hostTurnToNbcBody(
  body: OpeningTurn | ContinueTurn,
  offerType: string,
): NbcTurnBody {
  if (isContinueTurn(body)) {
    const payload = body.bind.payload;
    return {
      offer: { id: "", type: offerType, expires_turn: 0, expires_at_ms: 0 },
      ports: (body.expose ?? []).map(openingPortToSpec),
      bind_port_id: body.bind.portId,
      bind_payload: payload === undefined ? {} : (payload as JsonDocument),
    };
  }
  return {
    offer: { id: "", type: offerType, expires_turn: 0, expires_at_ms: 0 },
    ports: body.expose.map(openingPortToSpec),
    bind_port_id: "",
    bind_payload: null,
  };
}
