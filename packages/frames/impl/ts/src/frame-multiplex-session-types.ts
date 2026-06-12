import type { DuplexByteStream } from "@khoralabs/obp-byte-stream";
import type { HlcTimestamp, NbcBindPolicyValidateFn } from "@khoralabs/obp-nbc";
import type { ObpPersistenceClient } from "@khoralabs/obp-persistence";
import type { SessionOp } from "@khoralabs/obp-session-impl";
import type { FrameDag } from "./frame-dag";
import type { SessionInitTemplate } from "./frame-multiplex-session-helpers";
import type {
  FrameMultiplexOpenerApi,
  FrameSessionHandlers,
  MultiplexChainHooks,
} from "./frame-mux-types";
import type { SessionEnvelopeWire, SessionInitNormalized } from "./frame-protocol-types";
import type { FrameSigner, FrameVerifier } from "./frame-signer";

export type SessionEnvelopeSyncAdapter = {
  myPartyId?: string;
  getMyPartyId?: () => string;
  checkpointFromOps: (ops: SessionOp[]) => SessionEnvelopeWire["base_checkpoint"];
  verifyExtends: (args: {
    baseOps: unknown[];
    deltaOps: unknown[];
    claimed: SessionEnvelopeWire["new_checkpoint"];
  }) =>
    | { ok: true; checkpoint: SessionEnvelopeWire["new_checkpoint"] }
    | { ok: false; error: { code: string } };
};

export type RunFrameMultiplexSessionArgs = {
  channel: DuplexByteStream;
  signer: FrameSigner;
  verifier: FrameVerifier;
  client: ObpPersistenceClient;
  /** Responder expectation; pin `session_id` and `genesis_hash` when the host agrees them out-of-band. */
  sessionTemplate?: SessionInitTemplate;
  handlers: FrameSessionHandlers;
  sessionEnvelopeSync?: SessionEnvelopeSyncAdapter;
  initiatorChainPlans?: Array<{ init: SessionInitNormalized }>;
  closeChannelOnTerminate?: boolean;
  closeChannelWhenIdle?: boolean;
  openerSession?: (api: FrameMultiplexOpenerApi) => Promise<void>;
  /** NBC N4 bind payload validation when inbound TURN carries an active **`bind_policy`**. */
  validateBindPayload?: NbcBindPolicyValidateFn | undefined;
  /** Relay-client HLC effective now for NBC epoch bind windows. */
  getEffectiveNowMs?: () => number | null;
  /** Relay-client current HLC stamp for outbound TURN clock blocks. */
  getCurrentHlc?: () => HlcTimestamp;
};

/** Per-chain mutable state inside {@link MultiplexSessionRuntime}. */
export type ChainState = {
  init: SessionInitNormalized;
  dag: FrameDag;
  sessionOps: SessionOp[];
  confirmedSeq: number;
  pendingAck: boolean;
  active: boolean;
  hooks?: MultiplexChainHooks;
};
