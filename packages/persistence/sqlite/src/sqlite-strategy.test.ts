import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { ObpError } from "@khoralabs/obp-errors";
import { initObpSchema } from "./connection";
import { createObpSqlitePersistenceClient } from "./index";

function makeClient() {
  const db = new Database(":memory:");
  initObpSchema(db);
  return createObpSqlitePersistenceClient(db);
}

describe("SqliteObpPersistenceStrategy", () => {
  test("registerParty + getParty roundtrip", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Alice" });
    expect(party.name).toBe("Alice");
    expect((await client.getParty({ id: party.id })).result.kind).toBe("party");
    expect((await client.getParty({ id: "missing" })).result.kind).toBe("notFound");
  });

  test("extendOffer + bindPort + listBinds", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Bob" });
    const { offer } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "step" },
      bindPortId: "",
      bind_payload: null,
    });
    const { port } = await client.exposePort({
      offerId: offer.id,
      port: {
        id: "",
        type: "slot",
        promise: "p",
        ref: "",
      },
    });
    await client.bindPort({ offerId: offer.id, portId: port.id, bind_payload: { x: 1 } });
    const { binds } = await client.listBinds();
    const row = binds.find((b) => b.portId === port.id);
    expect(row?.bind_payload).toEqual({ x: 1 });
  });

  test("exposePort persists bind_policy and getPortBindPolicy reads it", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Dana" });
    const { offer } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "step" },
      bindPortId: "",
      bind_payload: null,
    });
    const policy = {
      type: "object",
      additionalProperties: false,
      properties: {
        x: { type: "string" },
      },
    };
    const { port } = await client.exposePort({
      offerId: offer.id,
      port: { id: "", type: "slot", promise: "p", ref: "" },
      bind_policy: policy,
    });
    const pr = await client.getPortBindPolicy({ portId: port.id });
    expect(pr.result.kind).toBe("found");
    if (pr.result.kind === "found") {
      expect(pr.result.bind_policy).toEqual(policy);
    }
  });

  test("exposePort rejects invalid bind_policy at expose time", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Policy" });
    const { offer } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "step" },
      bindPortId: "",
      bind_payload: null,
    });
    await expect(
      client.exposePort({
        offerId: offer.id,
        port: { id: "", type: "slot", promise: "p", ref: "" },
        bind_policy: {
          type: "object",
          notARealKeyword: true,
        },
      }),
    ).rejects.toThrow(/bind_policy|strict|unknown keyword/i);
  });

  test("exposePort persists max_bindings default 1", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Erin" });
    const { offer } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "step" },
      bindPortId: "",
      bind_payload: null,
    });
    const { port } = await client.exposePort({
      offerId: offer.id,
      port: { id: "", type: "slot", promise: "p", ref: "" },
    });
    const pr = await client.getPortExposePolicy({ portId: port.id });
    expect(pr.result.kind).toBe("found");
    if (pr.result.kind === "found") {
      expect(pr.result.policy.max_bindings).toBe(1);
    }
  });

  test("N5 multi-expose shares one max_bindings tally", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Frank" });
    const { offer: offerA } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "a" },
      bindPortId: "",
      bind_payload: null,
    });
    const { offer: offerB } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "b" },
      bindPortId: "",
      bind_payload: null,
    });
    const { port } = await client.exposePort({
      offerId: offerA.id,
      port: { id: "shared", type: "slot", promise: "p", ref: "" },
      max_bindings: 1,
    });
    await client.exposePort({
      offerId: offerB.id,
      port: { id: "shared", type: "slot", promise: "p", ref: "" },
    });
    await client.bindPort({
      offerId: offerA.id,
      portId: port.id,
      bind_payload: null,
    });
    await expect(
      client.bindPort({
        offerId: offerB.id,
        portId: port.id,
        bind_payload: null,
      }),
    ).rejects.toThrow(ObpError);
  });

  test("assertAdmissible runs inside bindPort transaction", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Hank" });
    const { offer: offerA } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "a" },
      bindPortId: "",
      bind_payload: null,
    });
    const { offer: offerB } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "b" },
      bindPortId: "",
      bind_payload: null,
    });
    const { port } = await client.exposePort({
      offerId: offerA.id,
      port: { id: "admit-port", type: "slot", promise: "p", ref: "" },
      max_bindings: 1,
    });
    await client.exposePort({
      offerId: offerB.id,
      port: { id: "admit-port", type: "slot", promise: "p", ref: "" },
    });
    await client.bindPort({
      offerId: offerA.id,
      portId: port.id,
      bind_payload: null,
      assertAdmissible: (snap) => {
        if (snap.binds.length >= 1) {
          throw new ObpError("MAX_BINDINGS", "admission rejected in txn");
        }
      },
    });
    await expect(
      client.bindPort({
        offerId: offerB.id,
        portId: port.id,
        bind_payload: null,
        assertAdmissible: (snap) => {
          if (snap.binds.length >= 1) {
            throw new ObpError("MAX_BINDINGS", "admission rejected in txn");
          }
        },
      }),
    ).rejects.toMatchObject({ code: "MAX_BINDINGS" });
  });

  test("N6 concurrent binds allow at most one success", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Gina" });
    const { offer: offerA } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "a" },
      bindPortId: "",
      bind_payload: null,
    });
    const { offer: offerB } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "b" },
      bindPortId: "",
      bind_payload: null,
    });
    const { port } = await client.exposePort({
      offerId: offerA.id,
      port: { id: "cap-port", type: "slot", promise: "p", ref: "" },
      max_bindings: 1,
    });
    await client.exposePort({
      offerId: offerB.id,
      port: { id: "cap-port", type: "slot", promise: "p", ref: "" },
    });

    const results = await Promise.allSettled([
      client.bindPort({ offerId: offerA.id, portId: port.id, bind_payload: null }),
      client.bindPort({ offerId: offerB.id, portId: port.id, bind_payload: null }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(ObpError);
      expect((rejected[0].reason as ObpError).code).toBe("MAX_BINDINGS");
    }
  });

  test("setOfferExpiredNow cascades to exposed ports", async () => {
    const client = makeClient();
    const { party } = await client.registerParty({ name: "Carol" });
    const { offer } = await client.extendOffer({
      partyId: party.id,
      offer: { id: "", type: "step" },
      bindPortId: "",
      bind_payload: null,
    });
    const { port } = await client.exposePort({
      offerId: offer.id,
      port: {
        id: "",
        type: "slot",
        promise: "",
        ref: "",
      },
    });
    await client.setOfferExpiredNow(offer.id);
    const pw = await client.getNbcBindWindowForPort(port.id);
    expect(pw.result.kind).toBe("window");
    if (pw.result.kind === "window") {
      expect(pw.result.window.nbc_expires_turn).toBe(0);
      expect(pw.result.window.nbc_expires_at_relay_ms).toBe(1);
    }
  });
});
