import type { NbcTurnBody } from "@khoralabs/obp-nbc";
import type { SessionInitNormalized } from "./frame-protocol-types";

export type GraphAdvancedReason = "turn" | "end_offers";

export type GraphAdvancedEvent = {
  readonly sessionId: string;
  readonly reason: GraphAdvancedReason;
  readonly body?: NbcTurnBody;
};

/** Handle passed to session handlers and {@link FrameSessionHandlers.onSessionReady}. */
export type FrameSessionHandle = {
  readonly sessionId: string;
  readonly init: SessionInitNormalized;
  readonly remoteActor: string;
  get tipHash(): string;
  sendTurn(body: NbcTurnBody): Promise<void>;
  endOffers(): Promise<void>;
  terminate(reason: string, code?: string): Promise<void>;
};

/** Per-chain handlers when multiplexing; falls back to {@link FrameSessionHandlers} on the same runner when absent. */
export type MultiplexChainHooks = {
  onIncomingOffer?: (body: NbcTurnBody, session: FrameSessionHandle) => Promise<NbcTurnBody | null>;
  onTerminate?: (
    reason: string,
    code: string | undefined,
    session: FrameSessionHandle,
  ) => Promise<void>;
  /** Fire-and-forget after a TURN or END_OFFERS is applied on this replica. */
  onGraphAdvanced?: (
    event: GraphAdvancedEvent,
    session: FrameSessionHandle,
  ) => void | Promise<void>;
};

export type FrameMultiplexOpenerApi = {
  init(init: SessionInitNormalized, hooks?: MultiplexChainHooks): Promise<FrameSessionHandle>;
  close(): void;
};

export type FrameSessionHandlers = {
  onSessionReady?: (session: FrameSessionHandle) => Promise<void>;
  onIncomingOffer?: (body: NbcTurnBody, session: FrameSessionHandle) => Promise<NbcTurnBody | null>;
  onTerminate?: (reason: string, code: string | undefined, sessionId?: string) => Promise<void>;
  onGraphAdvanced?: (
    event: GraphAdvancedEvent,
    session: FrameSessionHandle,
  ) => void | Promise<void>;
  /** Called when a frame is skipped due to a decode or validation error from an untrusted peer. */
  onFrameError?: (error: unknown, context: "decode" | "process") => void;
};
