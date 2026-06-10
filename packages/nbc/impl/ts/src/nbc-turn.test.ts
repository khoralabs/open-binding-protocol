import { describe, expect, test } from "bun:test";
import { validateNbcBindPayloadForPort } from "@khoralabs/nbc-bind-policy";
import { ObpError } from "@khoralabs/obp-errors";
import type { JsonDocument } from "@khoralabs/obp-model";
import { createInMemoryObpPersistenceClient } from "@khoralabs/obp-persistence";
import { getBindablePortsForParty, isSessionAdvanceable, nbcNaturalStop } from "./nbc-session";
import { applyNbcTurn } from "./nbc-turn";
import { parseNbcTurnBody } from "./nbc-types";

const timing0 = { turnSeq: 0, relayTsMs: 1 } as const;

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

describe("applyNbcTurn", () => {
  test("extend + expose + bind", async () => {
    const client = createInMemoryObpPersistenceClient();
    const { party: a } = await client.registerParty({ name: "A" });
    const { party: b } = await client.registerParty({ name: "B" });

    const bodyA = parseNbcTurnBody({
      offer: {
        id: "",
        expires_turn: 100,
        expires_at_relay_ms: 0,
        type: "step",
      },
      ports: [
        {
          id: "",
          type: "slot",
          promise: "pick",
          expires_turn: 100,
          expires_at_relay_ms: 0,
          bind_policy: null,
          ref: "",
        },
      ],
      bind_port_id: "",
      bind_payload: null,
    });
    const r1 = await applyNbcTurn({
      partyId: a.id,
      body: bodyA,
      client,
      timing: timing0,
    });
    expect(r1.exposedPortIds.length).toBe(1);
    const counterpartyPortId = r1.exposedPortIds[0];
    if (counterpartyPortId === undefined) throw new Error("expected port");

    const bodyB = parseNbcTurnBody({
      offer: {
        id: "",
        expires_turn: 100,
        expires_at_relay_ms: 0,
        type: "reply",
      },
      ports: [],
      bind_port_id: counterpartyPortId,
      bind_payload: {},
    });
    await applyNbcTurn({ partyId: b.id, body: bodyB, client, timing: timing0 });
    const binds = await client.listBinds();
    expect(binds.binds.some((x) => x.portId === counterpartyPortId)).toBe(true);
  });

  test("persisted bind_policy enables later-turn bind with normalized payload", async () => {
    const client = createInMemoryObpPersistenceClient();
    const { party: a } = await client.registerParty({ name: "A" });
    const { party: b } = await client.registerParty({ name: "B" });

    const bodyA = parseNbcTurnBody({
      offer: {
        id: "",
        expires_turn: 100,
        expires_at_relay_ms: 0,
        type: "step",
      },
      ports: [
        {
          id: "",
          type: "slot",
          promise: "pick",
          expires_turn: 100,
          expires_at_relay_ms: 0,
          bind_policy: textBindSchema,
          ref: "",
        },
      ],
      bind_port_id: "",
      bind_payload: null,
    });
    const r1 = await applyNbcTurn({
      partyId: a.id,
      body: bodyA,
      client,
      timing: timing0,
    });
    const pid = r1.exposedPortIds[0];
    if (pid === undefined) throw new Error("expected port");

    const bodyB = parseNbcTurnBody({
      offer: {
        id: "",
        expires_turn: 100,
        expires_at_relay_ms: 0,
        type: "reply",
      },
      ports: [],
      bind_port_id: pid,
      bind_payload: { greeting: "yo" },
    });
    await applyNbcTurn({
      partyId: b.id,
      body: bodyB,
      client,
      timing: timing0,
      validateBindPayload: (bp, pl) => validateNbcBindPayloadForPort(bp, pl) as JsonDocument,
    });
    const { binds } = await client.listBinds();
    const row = binds.find((x) => x.portId === pid);
    expect(row?.bind_payload).toEqual({ greeting: "yo" });
  });

  test("concurrent binds: only one applyNbcTurn succeeds at max_bindings 1", async () => {
    const client = createInMemoryObpPersistenceClient();
    const { party: a } = await client.registerParty({ name: "A" });
    const { party: b } = await client.registerParty({ name: "B" });
    const { party: c } = await client.registerParty({ name: "C" });

    const r1 = await applyNbcTurn({
      partyId: a.id,
      body: parseNbcTurnBody({
        offer: { id: "", expires_turn: 100, expires_at_relay_ms: 0, type: "step" },
        ports: [
          {
            id: "race-port",
            type: "slot",
            promise: "p",
            expires_turn: 100,
            expires_at_relay_ms: 0,
            bind_policy: null,
            ref: "",
            max_bindings: 1,
          },
        ],
        bind_port_id: "",
        bind_payload: null,
      }),
      client,
      timing: timing0,
    });
    const portId = r1.exposedPortIds[0];
    if (portId === undefined) throw new Error("expected port");

    const turnFor = (partyId: string, type: string) =>
      applyNbcTurn({
        partyId,
        body: parseNbcTurnBody({
          offer: { id: "", expires_turn: 100, expires_at_relay_ms: 0, type },
          ports: [],
          bind_port_id: portId,
          bind_payload: null,
        }),
        client,
        timing: timing0,
      });

    const results = await Promise.allSettled([turnFor(b.id, "b"), turnFor(c.id, "c")]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(ObpError);
      expect((rejected[0].reason as ObpError).code).toBe("MAX_BINDINGS");
    }
  });

  test("rejects second bind when max_bindings is 1", async () => {
    const client = createInMemoryObpPersistenceClient();
    const { party: a } = await client.registerParty({ name: "A" });
    const { party: b } = await client.registerParty({ name: "B" });
    const { party: c } = await client.registerParty({ name: "C" });

    const r1 = await applyNbcTurn({
      partyId: a.id,
      body: parseNbcTurnBody({
        offer: { id: "", expires_turn: 100, expires_at_relay_ms: 0, type: "step" },
        ports: [
          {
            id: "shared-port",
            type: "slot",
            promise: "p",
            expires_turn: 100,
            expires_at_relay_ms: 0,
            bind_policy: null,
            ref: "",
            max_bindings: 1,
          },
        ],
        bind_port_id: "",
        bind_payload: null,
      }),
      client,
      timing: timing0,
    });
    const portId = r1.exposedPortIds[0];
    if (portId === undefined) throw new Error("expected port");

    await applyNbcTurn({
      partyId: b.id,
      body: parseNbcTurnBody({
        offer: { id: "", expires_turn: 100, expires_at_relay_ms: 0, type: "o1" },
        ports: [],
        bind_port_id: portId,
        bind_payload: null,
      }),
      client,
      timing: timing0,
    });

    await expect(
      applyNbcTurn({
        partyId: c.id,
        body: parseNbcTurnBody({
          offer: { id: "", expires_turn: 100, expires_at_relay_ms: 0, type: "o2" },
          ports: [],
          bind_port_id: portId,
          bind_payload: null,
        }),
        client,
        timing: timing0,
      }),
    ).rejects.toThrow(ObpError);
  });
});

describe("nbc session reads", () => {
  test("getBindablePortsForParty filters by extending party", async () => {
    const client = createInMemoryObpPersistenceClient();
    const { party: alice } = await client.registerParty({ name: "Alice" });
    const { party: bob } = await client.registerParty({ name: "Bob" });

    const body = parseNbcTurnBody({
      offer: {
        id: "",
        expires_turn: 100,
        expires_at_relay_ms: 0,
        type: "step",
      },
      ports: [
        {
          id: "",
          type: "x",
          promise: "",
          expires_turn: 100,
          expires_at_relay_ms: 0,
          bind_policy: null,
          ref: "",
        },
      ],
      bind_port_id: "",
      bind_payload: null,
    });
    const { exposedPortIds } = await applyNbcTurn({
      partyId: alice.id,
      body,
      client,
      timing: timing0,
    });
    const pid = exposedPortIds[0];
    if (pid === undefined) throw new Error("port");

    const forBob = await getBindablePortsForParty(alice.id, client, timing0);
    expect(forBob.some((e) => e.portId === pid)).toBe(true);
    const forAlice = await getBindablePortsForParty(bob.id, client, timing0);
    expect(forAlice.some((e) => e.portId === pid)).toBe(false);
  });

  test("nbcNaturalStop after empty turn with no bindables", async () => {
    const client = createInMemoryObpPersistenceClient();
    const { party } = await client.registerParty({ name: "Solo" });
    const body = parseNbcTurnBody({
      offer: {
        id: "",
        expires_turn: 100,
        expires_at_relay_ms: 0,
        type: "step",
      },
      ports: [],
      bind_port_id: "",
      bind_payload: null,
    });
    await applyNbcTurn({ partyId: party.id, body, client, timing: timing0 });
    expect(await isSessionAdvanceable(client, timing0)).toBe(false);
    expect(await nbcNaturalStop(0, client, timing0)).toBe(true);
  });
});
