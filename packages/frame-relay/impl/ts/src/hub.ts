import {
  generateChannelSecretHex,
  signChannelTicket,
  verifyChannelTicketClaims,
} from "@khoralabs/duplex-byte-stream";
import type { FrameRelayAdmissionPolicy } from "./admission-policy";
import type { AttachPeerOptions, FrameRelayHubPort, FrameRelayPeer } from "./hub-port";
import { relayOutBytesForMessage } from "./relay-envelope";
import {
  capReplayTail,
  DEFAULT_FRAME_RELAY_SPOOL_LIMITS,
  type FrameRelaySpoolLimits,
} from "./spool-limits";
import type { FrameRelayStoreStrategy } from "./store-types";
import { TicketNonceRegistry } from "./ticket-nonce-registry";

export type { FrameRelayAdmissionPolicy } from "./admission-policy";

export type CreateFrameRelayHubOptions = {
  store: FrameRelayStoreStrategy;
  spoolLimits?: FrameRelaySpoolLimits;
  /**
   * Optional admission hardening. Default tickets are reusable until channel expiry;
   * enable `singleUseTickets`, `ticketTtlMs`, and/or `rotateOnMint` when needed.
   */
  admissionPolicy?: FrameRelayAdmissionPolicy;
};

export function createFrameRelayHub(options: CreateFrameRelayHubOptions): FrameRelayHubPort {
  const { store, admissionPolicy } = options;
  const spoolLimits = options.spoolLimits ?? DEFAULT_FRAME_RELAY_SPOOL_LIMITS;
  const peers = new Map<string, Set<FrameRelayPeer>>();
  const nonceRegistry = new TicketNonceRegistry();

  const getPeerSet = (channelId: string): Set<FrameRelayPeer> => {
    let set = peers.get(channelId);
    if (set === undefined) {
      set = new Set();
      peers.set(channelId, set);
    }
    return set;
  };

  const issueTicket = async (
    channelId: string,
    secret: string,
    channelExpiresAtMs: number,
  ): Promise<string> => {
    const now = Date.now();
    const ticketExpiresAtMs =
      admissionPolicy?.ticketTtlMs !== undefined && admissionPolicy.ticketTtlMs > 0
        ? now + admissionPolicy.ticketTtlMs
        : channelExpiresAtMs;
    const claims = { expiresAtMs: ticketExpiresAtMs };
    if (admissionPolicy?.singleUseTickets === true) {
      const nonceHex = generateChannelSecretHex(16);
      nonceRegistry.register(channelId, nonceHex, ticketExpiresAtMs);
      return signChannelTicket(channelId, secret, { ...claims, nonceHex });
    }
    return signChannelTicket(channelId, secret, claims);
  };

  const verifyTicketForChannel = async (channelId: string, ticket: string): Promise<boolean> => {
    const now = Date.now();
    const admission = store.getChannelAdmissionIfActive(channelId, now);
    if (admission === undefined) {
      return false;
    }
    const claims = await verifyChannelTicketClaims(
      channelId,
      ticket,
      admission.pairingSecretHex,
      now,
    );
    if (claims === null) {
      return false;
    }
    if (claims.nonceHex === undefined) {
      return true;
    }
    return nonceRegistry.admit(
      channelId,
      claims.nonceHex,
      now,
      admissionPolicy?.singleUseTickets === true,
    );
  };

  return {
    async createChannel(channelId: string, ttlMs = 86_400_000): Promise<{ ticket: string }> {
      const secret = generateChannelSecretHex();
      const now = Date.now();
      const expiresAtMs = now + ttlMs;
      nonceRegistry.purgeChannel(channelId);
      const ticket = await issueTicket(channelId, secret, expiresAtMs);
      store.upsertChannelAdmission({
        channelId,
        pairingSecretHex: secret,
        createdAtMs: now,
        expiresAtMs,
      });
      store.purgeRelayedFramesForChannel(channelId);
      return { ticket };
    },

    async mintChannelTicket(channelId: string): Promise<{ ticket: string } | undefined> {
      if (admissionPolicy?.rotateOnMint === true) {
        try {
          const { ticket } = await this.rotateChannelTicket(channelId);
          return { ticket };
        } catch {
          return undefined;
        }
      }
      const admission = store.getChannelAdmissionIfActive(channelId, Date.now());
      if (admission === undefined) {
        return undefined;
      }
      const ticket = await issueTicket(
        channelId,
        admission.pairingSecretHex,
        admission.expiresAtMs,
      );
      return { ticket };
    },

    async rotateChannelTicket(channelId: string, ttlMs = 86_400_000): Promise<{ ticket: string }> {
      const prior = store.getChannelAdmissionIfActive(channelId, Date.now());
      if (prior === undefined) {
        throw new Error(`FrameRelayHub: no active channel to rotate ticket for: ${channelId}`);
      }
      const secret = generateChannelSecretHex();
      const now = Date.now();
      const expiresAtMs = now + ttlMs;
      nonceRegistry.purgeChannel(channelId);
      const ticket = await issueTicket(channelId, secret, expiresAtMs);
      store.upsertChannelAdmission({
        channelId,
        pairingSecretHex: secret,
        createdAtMs: now,
        expiresAtMs,
      });
      return { ticket };
    },

    async verifyTicket(channelId: string, ticket: string): Promise<boolean> {
      return verifyTicketForChannel(channelId, ticket);
    },

    async attachPeer(
      channelId: string,
      peer: FrameRelayPeer,
      ticket: string,
      attachOptions?: AttachPeerOptions,
    ): Promise<void> {
      const ok = await verifyTicketForChannel(channelId, ticket);
      if (!ok) {
        throw new Error(`FrameRelayHub: invalid or expired ticket for channel: ${channelId}`);
      }
      const set = getPeerSet(channelId);
      set.add(peer);
      const afterId = attachOptions?.replayAfterFrameId ?? 0;
      const replay = capReplayTail(store.listRelayedFramesAfter(channelId, afterId), spoolLimits);
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

    purgeExpiredChannels(nowMs = Date.now()): number {
      nonceRegistry.purgeExpired(nowMs);
      return store.purgeExpiredChannels(nowMs);
    },
  };
}
