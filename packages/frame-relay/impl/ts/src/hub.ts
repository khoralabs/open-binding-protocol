import {
  generateChannelSecretHex,
  signChannelTicket,
  verifyChannelTicket,
} from "@khoralabs/duplex-byte-stream";
import type { FrameRelayHubPort, FrameRelayPeer } from "./hub-port";
import { relayOutBytesForMessage } from "./relay-envelope";
import type { FrameRelayStoreStrategy } from "./store-types";

export type CreateFrameRelayHubOptions = {
  store: FrameRelayStoreStrategy;
};

export function createFrameRelayHub(options: CreateFrameRelayHubOptions): FrameRelayHubPort {
  const { store } = options;
  const peers = new Map<string, Set<FrameRelayPeer>>();

  const getPeerSet = (channelId: string): Set<FrameRelayPeer> => {
    let set = peers.get(channelId);
    if (set === undefined) {
      set = new Set();
      peers.set(channelId, set);
    }
    return set;
  };

  const verifyTicketForChannel = async (channelId: string, ticket: string): Promise<boolean> => {
    const secret = store.getPairingSecretIfActive(channelId, Date.now());
    if (secret === undefined) {
      return false;
    }
    return verifyChannelTicket(channelId, ticket, secret);
  };

  return {
    async createChannel(channelId: string, ttlMs = 86_400_000): Promise<{ ticket: string }> {
      const secret = generateChannelSecretHex();
      const ticket = await signChannelTicket(channelId, secret);
      const now = Date.now();
      store.upsertChannelAdmission({
        channelId,
        pairingSecretHex: secret,
        createdAtMs: now,
        expiresAtMs: now + ttlMs,
      });
      store.purgeRelayedFramesForChannel(channelId);
      return { ticket };
    },

    async mintChannelTicket(channelId: string): Promise<{ ticket: string } | undefined> {
      const secret = store.getPairingSecretIfActive(channelId, Date.now());
      if (secret === undefined) {
        return undefined;
      }
      const ticket = await signChannelTicket(channelId, secret);
      return { ticket };
    },

    async rotateChannelTicket(channelId: string, ttlMs = 86_400_000): Promise<{ ticket: string }> {
      const prior = store.getPairingSecretIfActive(channelId, Date.now());
      if (prior === undefined) {
        throw new Error(`FrameRelayHub: no active channel to rotate ticket for: ${channelId}`);
      }
      const secret = generateChannelSecretHex();
      const ticket = await signChannelTicket(channelId, secret);
      const now = Date.now();
      store.upsertChannelAdmission({
        channelId,
        pairingSecretHex: secret,
        createdAtMs: now,
        expiresAtMs: now + ttlMs,
      });
      return { ticket };
    },

    async verifyTicket(channelId: string, ticket: string): Promise<boolean> {
      return verifyTicketForChannel(channelId, ticket);
    },

    async attachPeer(channelId: string, peer: FrameRelayPeer, ticket: string): Promise<void> {
      const ok = await verifyTicketForChannel(channelId, ticket);
      if (!ok) {
        throw new Error(`FrameRelayHub: invalid or expired ticket for channel: ${channelId}`);
      }
      const set = getPeerSet(channelId);
      set.add(peer);
      const replay = store.listRelayedFramesAfter(channelId, 0);
      for (const row of replay) {
        peer.send(row.bytes);
      }
    },

    detachPeer(channelId: string, peer: FrameRelayPeer): void {
      const set = peers.get(channelId);
      if (set === undefined) {
        return;
      }
      set.delete(peer);
      if (set.size === 0) {
        peers.delete(channelId);
      }
    },

    relayBytes(channelId: string, _from: FrameRelayPeer, bytes: Uint8Array): void {
      const out = relayOutBytesForMessage(bytes);
      if (out === null) {
        return;
      }
      store.enqueueRelayedFrame(channelId, out);
      const set = peers.get(channelId);
      if (set === undefined) {
        return;
      }
      for (const peer of set) {
        peer.send(out);
      }
    },
  };
}
