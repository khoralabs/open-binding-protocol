type NonceEntry = {
  expiresAtMs: number;
  consumed: boolean;
};

/** In-process nonce table for v1 tickets (single-use / short TTL admission). */
export class TicketNonceRegistry {
  private readonly byChannel = new Map<string, Map<string, NonceEntry>>();

  register(channelId: string, nonceHex: string, expiresAtMs: number): void {
    let channel = this.byChannel.get(channelId);
    if (channel === undefined) {
      channel = new Map();
      this.byChannel.set(channelId, channel);
    }
    channel.set(nonceHex, { expiresAtMs, consumed: false });
  }

  /**
   * Returns true when the nonce is known, unexpired, and (if singleUse) not yet consumed.
   */
  admit(channelId: string, nonceHex: string, nowMs: number, singleUse: boolean): boolean {
    const channel = this.byChannel.get(channelId);
    const entry = channel?.get(nonceHex);
    if (entry === undefined || entry.expiresAtMs <= nowMs) {
      return false;
    }
    if (singleUse && entry.consumed) {
      return false;
    }
    if (singleUse) {
      entry.consumed = true;
    }
    return true;
  }

  purgeChannel(channelId: string): void {
    this.byChannel.delete(channelId);
  }

  purgeExpired(nowMs: number): void {
    for (const [channelId, nonces] of this.byChannel.entries()) {
      for (const [nonceHex, entry] of nonces.entries()) {
        if (entry.expiresAtMs <= nowMs) {
          nonces.delete(nonceHex);
        }
      }
      if (nonces.size === 0) {
        this.byChannel.delete(channelId);
      }
    }
  }
}
