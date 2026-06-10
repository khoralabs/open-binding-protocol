import type { DuplexByteStream } from "@khoralabs/duplex-byte-stream";
import type { NbcBindPolicyValidateFn } from "@khoralabs/obp-nbc";
import type { ObpPersistenceClient } from "@khoralabs/obp-persistence";
import type { SessionOp } from "@khoralabs/obp-session-impl";

import type { FrameDag } from "./frame-dag";
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
  sessionTemplate?: Pick<SessionInitNormalized, "parties">;
  handlers: FrameSessionHandlers;
  sessionEnvelopeSync?: SessionEnvelopeSyncAdapter;
  initiatorChainPlans?: Array<{ init: SessionInitNormalized }>;
  closeChannelOnTerminate?: boolean;
  closeChannelWhenIdle?: boolean;
  openerSession?: (api: FrameMultiplexOpenerApi) => Promise<void>;
  /** NBC N4 bind payload validation when inbound TURN carries an active **`bind_policy`**. */
  validateBindPayload?: NbcBindPolicyValidateFn | undefined;
  /**
   * When true, negotiation `Frame.body` values use ephemeral X25519 + AES-GCM after the
   * signed END_OFFERS handshake (see `docs/FRAME_CHANNEL_E2EE.md`). Reference transports
   * (`@khoralabs/obp-transport-ws`, `@khoralabs/obp-transport-http2`) enable this by default.
   * Omit only for in-process tests or when TLS end-to-end trust is explicitly sufficient.
   */
  frameChannelBodyE2ee?: boolean;
  /**
   * HKDF domain separation for frame-body E2EE (e.g. room id). Never use the host room pairing secret.
   * @see docs/FRAME_CHANNEL_E2EE.md
   */
  e2eeChannelBinding?: string;
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
