/** Channel admission row (ticket HMAC secret + TTL). Maps to `rooms.channel_id` in reference SQLite. */
export type ChannelAdmissionRecord = {
  channelId: string;
  pairingSecretHex: string;
  createdAtMs: number;
  expiresAtMs: number;
};

/** One persisted opaque relayed frame for replay / buffering. */
export type RelayedFrameRecord = {
  id: number;
  bytes: Uint8Array;
};

/**
 * Adapter for {@link FrameRelayStore} Smithy operations.
 * Swap implementations (in-memory, SQLite, remote service) without changing hub runtime code.
 */
export interface FrameRelayStoreStrategy {
  upsertChannelAdmission(record: ChannelAdmissionRecord): void;
  getPairingSecretIfActive(channelId: string, nowMs: number): string | undefined;
  getChannelAdmissionIfActive(channelId: string, nowMs: number): ChannelAdmissionRecord | undefined;
  enqueueRelayedFrame(channelId: string, bytes: Uint8Array): number;
  listRelayedFramesAfter(channelId: string, afterId: number): RelayedFrameRecord[];
  purgeRelayedFramesForChannel(channelId: string): void;
  deleteChannelAdmission(channelId: string): void;
  /** Remove expired admissions and their relayed frames; returns channels purged. */
  purgeExpiredChannels(nowMs: number): number;
}
