/**
 * Input / output shapes and result unions for `ObpPersistence` — see
 * `packages/persistence/spec/model/persistence.smithy`.
 */

import type { JsonDocument, Offer, Party, Port } from "@khoralabs/obp-core";

// ---------------------------------------------------------------------------
// Result unions (Smithy `union GetXResult`)
// ---------------------------------------------------------------------------

export type GetPartyResult =
  | { readonly kind: "notFound" }
  | { readonly kind: "party"; party: Party };
export type GetOfferResult =
  | { readonly kind: "notFound" }
  | { readonly kind: "offer"; offer: Offer };
export type GetPortResult = { readonly kind: "notFound" } | { readonly kind: "port"; port: Port };

// ---------------------------------------------------------------------------
// RegisterParty
// ---------------------------------------------------------------------------

export type RegisterPartyInput = {
  name: string;
  /** Optional explicit party ID. When omitted, the strategy generates a random UUID. */
  id?: string;
};

export type RegisterPartyOutput = {
  party: Party;
};

// ---------------------------------------------------------------------------
// GetParty / GetOffer / GetPort
// ---------------------------------------------------------------------------

export type GetPartyInput = { id: string };
export type GetPartyOutput = { result: GetPartyResult };

export type GetOfferInput = { id: string };
export type GetOfferOutput = { result: GetOfferResult };

export type GetPortInput = { id: string };
export type GetPortOutput = { result: GetPortResult };

export type GetPortBindPolicyResult =
  | { readonly kind: "notFound" }
  | { readonly kind: "found"; bind_policy: JsonDocument };

export type GetPortBindPolicyInput = { portId: string };
export type GetPortBindPolicyOutput = { result: GetPortBindPolicyResult };

/** NBC expose-time policy persisted on the port row (`khora.obp.nbc#NbcPortExposePolicy`). */
export type ObpPortExposePolicy = {
  max_bindings: number;
  terminal: boolean;
  ttl_basis: string | null;
  ttl_measure: number | null;
  expose_seq: number | null;
};

export type GetPortExposePolicyResult =
  | { readonly kind: "notFound" }
  | { readonly kind: "found"; policy: ObpPortExposePolicy };

export type GetPortExposePolicyInput = { portId: string };
export type GetPortExposePolicyOutput = { result: GetPortExposePolicyResult };

// ---------------------------------------------------------------------------
// ExtendOffer
// ---------------------------------------------------------------------------

export type ExtendOfferInput = {
  partyId: string;
  offer: Offer;
  /** NBC N1 bind-window projection for this offer row — not on thin `Offer`. Default `0` when omitted. */
  nbc_expires_turn?: number;
  nbc_expires_at_ms?: number;
  /** When empty string, no BINDS edge is created. */
  bindPortId: string;
  /** Policy-shaped; NBC validates (`NbcBindSatisfaction`). `null` when not provided. */
  bind_payload: JsonDocument;
};

export type ExtendOfferOutput = {
  offer: Offer;
};

// ---------------------------------------------------------------------------
// ExposePort
// ---------------------------------------------------------------------------

export type ExposePortInput = {
  offerId: string;
  port: Port;
  /** NBC N1 bind-window projection — not on thin `Port`. Default `0` when omitted. */
  nbc_expires_turn?: number;
  nbc_expires_at_ms?: number;
  /** NBC expose-time bind policy persisted on port row; `null` when inactive. */
  bind_policy?: JsonDocument;
  /** NBC N2 bind capacity; default **1** when omitted. */
  max_bindings?: number;
  /** NBC orchestration hint; default **false** when omitted. */
  terminal?: boolean;
  /** NBC TTL basis when set; `null` when unset. */
  ttl_basis?: string | null;
  /** NBC TTL measure when set; `null` when unset. */
  ttl_measure?: number | null;
  /** Coordinator turn / ledger tick at expose; `null` when unset. */
  expose_seq?: number | null;
};

export type ExposePortOutput = {
  port: Port;
};

// ---------------------------------------------------------------------------
// BindPort
// ---------------------------------------------------------------------------

/** Fresh graph snapshot for admission checks inside a `bindPort` store transaction (N6). */
export type BindPortTxnSnapshot = {
  portsById: ReadonlyMap<string, Port>;
  binds: readonly { portId: string }[];
  exposedPortIds: ReadonlySet<string>;
  offerNbcById: ReadonlyMap<string, ObpNbcBindWindow>;
  portNbcById: ReadonlyMap<string, ObpNbcBindWindow>;
  portExposePolicyById: ReadonlyMap<string, ObpPortExposePolicy>;
};

export type BindPortInput = {
  offerId: string;
  portId: string;
  /** Policy-shaped; NBC validates. `null` when not provided. */
  bind_payload: JsonDocument;
  /**
   * When set, runs inside the store transaction immediately before insert.
   * Use for NBC N1–N3/N2 admission against {@link BindPortTxnSnapshot} so validate + capacity + insert are atomic.
   */
  assertAdmissible?: (snapshot: BindPortTxnSnapshot) => void;
};

/** Empty output shape — success is signalled by resolution (no error thrown). */
export type BindPortOutput = Record<string, never>;

// ---------------------------------------------------------------------------
// ListExposedPortEdges
// ---------------------------------------------------------------------------

export type ListExposedPortEdgesInput = Record<string, never>;

export type ExposedPortEdge = {
  offerId: string;
  portId: string;
};

export type ExposedPortEdgeList = readonly ExposedPortEdge[];

export type ListExposedPortEdgesOutput = {
  edges: ExposedPortEdgeList;
};

// ---------------------------------------------------------------------------
// IsPortExposed
// ---------------------------------------------------------------------------

export type IsPortExposedInput = { portId: string };
export type IsPortExposedOutput = { exposed: boolean };

// ---------------------------------------------------------------------------
// ListBinds
// ---------------------------------------------------------------------------

export type ListBindsInput = Record<string, never>;

export type BindListingRow = {
  offerId: string;
  portId: string;
  /** Persistence projection field; not on `khora.obp#BindsEdge`. */
  bind_payload: JsonDocument;
};

export type BindListingRowList = readonly BindListingRow[];

export type ListBindsOutput = {
  binds: BindListingRowList;
};

// ---------------------------------------------------------------------------
// GetPortsSnapshot
// ---------------------------------------------------------------------------

export type GetPortsSnapshotInput = Record<string, never>;

export type PortSnapshotEntry = {
  portId: string;
  port: Port;
};

export type PortSnapshotEntryList = readonly PortSnapshotEntry[];

export type GetPortsSnapshotOutput = {
  entries: PortSnapshotEntryList;
};

// ---------------------------------------------------------------------------
// GetExtendingPartyId
// ---------------------------------------------------------------------------

export type GetExtendingPartyIdInput = { offerId: string };

export type GetExtendingPartyIdOutput = {
  /** Empty string when no EXTENDS edge exists (Smithy `@default("")`). */
  partyId: string;
};

// ---------------------------------------------------------------------------
// GetNbcBindWindowForOffer / GetNbcBindWindowForPort
// ---------------------------------------------------------------------------

/** NBC N1 bind-window projection for an offer/port row — not on thin `Offer`/`Port`. */
export type ObpNbcBindWindow = {
  nbc_expires_turn: number;
  nbc_expires_at_ms: number;
};

export type GetNbcBindWindowResult =
  | { readonly kind: "notFound" }
  | { readonly kind: "window"; window: ObpNbcBindWindow };

export type GetNbcBindWindowForOfferInput = { offerId: string };
export type GetNbcBindWindowForOfferOutput = { result: GetNbcBindWindowResult };

export type GetNbcBindWindowForPortInput = { portId: string };
export type GetNbcBindWindowForPortOutput = { result: GetNbcBindWindowResult };

// ---------------------------------------------------------------------------
// SetPortExpiredNow / SetOfferExpiredNow
// ---------------------------------------------------------------------------

export type SetPortExpiredNowInput = { portId: string };
export type SetPortExpiredNowOutput = Record<string, never>;

export type SetOfferExpiredNowInput = { offerId: string };
export type SetOfferExpiredNowOutput = Record<string, never>;
