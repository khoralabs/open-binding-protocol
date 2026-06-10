import type { ServerWebSocket } from "bun";
import type { FrameRelayHubPort, FrameRelayPeer } from "./hub-port";

/** WebSocket `data` after a ticket-verified upgrade (`upgradeFrameRelayHubWebSocket`). */
export type FrameRelayHubWsData = { kind: "channel"; sessionId: string; ticket: string };

export type FrameRelayHubWsUpgradePort = {
  upgrade(req: Request, data: FrameRelayHubWsData): boolean;
};

function peerFromWebSocket(ws: ServerWebSocket<FrameRelayHubWsData>): FrameRelayPeer {
  return {
    send(bytes: Uint8Array) {
      ws.send(bytes);
    },
  };
}

function relayError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Reference WebSocket upgrade: verify hub admission ticket before upgrade.
 * Network deployments MUST use this (or equivalent) before {@link frameRelayHubWebSocketHandlers}.
 */
export async function upgradeFrameRelayHubWebSocket(opts: {
  req: Request;
  channelId: string;
  ticket: string;
  hub: FrameRelayHubPort;
  upgrade: FrameRelayHubWsUpgradePort["upgrade"];
}): Promise<Response | undefined> {
  if (opts.req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return relayError("Expected WebSocket upgrade", 426);
  }
  if (opts.ticket.length === 0) {
    return relayError("Missing ticket", 400);
  }
  const ok = await opts.hub.verifyTicket(opts.channelId, opts.ticket);
  if (!ok) {
    return relayError("Invalid or expired ticket", 401);
  }
  const upgraded = opts.upgrade(opts.req, {
    kind: "channel",
    sessionId: opts.channelId,
    ticket: opts.ticket,
  });
  if (!upgraded) {
    return relayError("WebSocket upgrade failed", 500);
  }
  return undefined;
}

export function frameRelayHubWebSocketHandlers(deps: { hub: FrameRelayHubPort }): {
  open(ws: ServerWebSocket<FrameRelayHubWsData>): void;
  close(ws: ServerWebSocket<FrameRelayHubWsData>): void;
  message(ws: ServerWebSocket<FrameRelayHubWsData>, message: string | Buffer): void;
} {
  const peerByWs = new WeakMap<ServerWebSocket<FrameRelayHubWsData>, FrameRelayPeer>();

  return {
    open(ws) {
      const d = ws.data;
      const peer = peerFromWebSocket(ws);
      peerByWs.set(ws, peer);
      void deps.hub.attachPeer(d.sessionId, peer, d.ticket).catch(() => {
        ws.close(1008, "invalid ticket");
      });
    },
    close(ws) {
      const d = ws.data;
      const peer = peerByWs.get(ws);
      if (peer !== undefined) {
        deps.hub.detachPeer(d.sessionId, peer);
      }
    },
    message(ws, message) {
      const d = ws.data;
      const peer = peerByWs.get(ws);
      if (peer === undefined) {
        return;
      }
      let bytes: Uint8Array;
      if (typeof message === "string") {
        bytes = new TextEncoder().encode(message);
      } else if (message instanceof ArrayBuffer) {
        bytes = new Uint8Array(message);
      } else {
        bytes = new Uint8Array(message.buffer, message.byteOffset, message.byteLength);
      }
      deps.hub.relayBytes(d.sessionId, peer, bytes);
    },
  };
}
