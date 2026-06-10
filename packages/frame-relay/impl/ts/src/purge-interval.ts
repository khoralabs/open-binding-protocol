import type { FrameRelayHubPort } from "./hub-port";

/** Periodically purge expired channel admissions and spooled frames. Returns `clearInterval` dispose. */
export function startFrameRelayPurgeInterval(
  hub: FrameRelayHubPort,
  intervalMs: number,
): () => void {
  const id = setInterval(() => {
    hub.purgeExpiredChannels();
  }, intervalMs);
  return () => clearInterval(id);
}
