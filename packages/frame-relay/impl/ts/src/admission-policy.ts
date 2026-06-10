/**
 * Optional hub admission controls. Default: tickets are reusable until channel `expires_at_ms`.
 *
 * - `singleUseTickets` — each issued ticket admits at most one `attachPeer`.
 * - `ticketTtlMs` — per-ticket expiry from mint time (enables short-lived join proofs).
 * - `rotateOnMint` — `mintChannelTicket` rotates the pairing secret (invalidates prior tickets).
 */
export type FrameRelayAdmissionPolicy = {
  singleUseTickets?: boolean;
  ticketTtlMs?: number;
  rotateOnMint?: boolean;
};
