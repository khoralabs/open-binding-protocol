import type { ServerWebSocket } from "bun";
import type { FrameRelayHubPort, FrameRelayPeer } from "./hub-port";

/** WebSocket `data` after a ticket-verified upgrade (`upgradeFrameRelayHubWebSocket`). */
export type FrameRelayHubWsData = { kind: "channel"; sessionId: string; ticket: string };

export type FrameRelayHubWsUpgradePort = {
  upgrade(req: Request, data: FrameRelayHubWsData): boolean;
};

/** Context passed to {@link FrameRelayHubWsAuthorizeHook} before WebSocket upgrade. */
export type FrameRelayHubWsUpgradeContext = {
  req: Request;
  channelId: string;
  ticket: string;
  /** `Origin` request header; `null` when absent (typical for non-browser clients). */
  origin: string | null;
};

/**
 * Optional host policy hook (principal binding, rate limits, etc.).
 * Return `true`/`undefined` to allow, `false` for 403, or a `Response` to return as-is.
 */
export type FrameRelayHubWsAuthorizeHook = (
  ctx: FrameRelayHubWsUpgradeContext,
) => boolean | Response | Promise<boolean | Response | undefined> | undefined;

export type FrameRelayHubWsOpenContext = {
  ws: ServerWebSocket<FrameRelayHubWsData>;
  sessionId: string;
  ticket: string;
};

/** Optional defense-in-depth hook before {@link FrameRelayHubPort.attachPeer} on `open`. */
export type FrameRelayHubWsOpenHook = (
  ctx: FrameRelayHubWsOpenContext,
) => boolean | Promise<boolean>;

export type AllowedWebSocketOriginOptions = {
  /** When true, reject upgrades with no `Origin` header (browser-only deployments). */
  rejectMissingOrigin?: boolean;
};

/** Read the `Origin` header from an upgrade request. */
export function webSocketRequestOrigin(req: Request): string | null {
  const origin = req.headers.get("origin")?.trim();
  return origin !== undefined && origin.length > 0 ? origin : null;
}

/**
 * Browser CSRF protection: when `Origin` is present it must match `allowedOrigins`.
 * Missing `Origin` is allowed unless `rejectMissingOrigin` is set (daemons often omit it).
 */
export function isAllowedWebSocketOrigin(
  origin: string | null,
  allowedOrigins: readonly string[],
  options?: AllowedWebSocketOriginOptions,
): boolean {
  if (origin === null) {
    return options?.rejectMissingOrigin !== true;
  }
  return allowedOrigins.includes(origin);
}

/** True when the request URL is `https:` or `x-forwarded-proto` indicates TLS termination. */
export function isSecureWebSocketUpgrade(req: Request): boolean {
  const url = new URL(req.url);
  if (url.protocol === "https:") {
    return true;
  }
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return forwarded === "https";
}

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

export type UpgradeFrameRelayHubWebSocketOptions = {
  req: Request;
  channelId: string;
  ticket: string;
  hub: FrameRelayHubPort;
  upgrade: FrameRelayHubWsUpgradePort["upgrade"];
  /**
   * Allowed `Origin` values for browser clients. **Network browser deployments MUST set this**
   * (or enforce equivalent policy in `authorize`) — ticket-only admission does not block
   * cross-site WebSocket CSRF when a victim's browser holds a valid ticket URL.
   */
  allowedOrigins?: readonly string[];
  allowedOriginOptions?: AllowedWebSocketOriginOptions;
  /** When true, reject non-TLS upgrade URLs (and non-`https` `x-forwarded-proto`). */
  requireTls?: boolean;
  authorize?: FrameRelayHubWsAuthorizeHook;
};

/**
 * Reference WebSocket upgrade: verify hub admission ticket before upgrade.
 * Network deployments MUST use this (or equivalent) before {@link frameRelayHubWebSocketHandlers}.
 *
 * **Host responsibilities (not enforced by default):**
 * - Set `allowedOrigins` for browser-facing relays (or check `Origin` in `authorize`).
 * - Terminate TLS at the edge; set `requireTls: true` when the upgrade `Request` sees HTTPS.
 * - Rate-limit upgrade attempts in `authorize` or outer `Bun.serve` middleware.
 */
export async function upgradeFrameRelayHubWebSocket(
  opts: UpgradeFrameRelayHubWebSocketOptions,
): Promise<Response | undefined> {
  if (opts.req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return relayError("Expected WebSocket upgrade", 426);
  }
  if (opts.requireTls === true && !isSecureWebSocketUpgrade(opts.req)) {
    return relayError("TLS required for WebSocket upgrade", 403);
  }
  const origin = webSocketRequestOrigin(opts.req);
  if (opts.allowedOrigins !== undefined) {
    if (!isAllowedWebSocketOrigin(origin, opts.allowedOrigins, opts.allowedOriginOptions)) {
      return relayError("Origin not allowed", 403);
    }
  }
  if (opts.ticket.length === 0) {
    return relayError("Missing ticket", 400);
  }
  if (opts.authorize !== undefined) {
    const auth = await opts.authorize({
      req: opts.req,
      channelId: opts.channelId,
      ticket: opts.ticket,
      origin,
    });
    if (auth === false) {
      return relayError("Forbidden", 403);
    }
    if (auth instanceof Response) {
      return auth;
    }
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

export function frameRelayHubWebSocketHandlers(deps: {
  hub: FrameRelayHubPort;
  /** Runs before `attachPeer`; return `false` to close the socket without joining. */
  onOpen?: FrameRelayHubWsOpenHook;
}): {
  open(ws: ServerWebSocket<FrameRelayHubWsData>): void;
  close(ws: ServerWebSocket<FrameRelayHubWsData>): void;
  message(ws: ServerWebSocket<FrameRelayHubWsData>, message: string | Buffer): void;
} {
  const peerByWs = new WeakMap<ServerWebSocket<FrameRelayHubWsData>, FrameRelayPeer>();

  return {
    open(ws) {
      const d = ws.data;
      void (async () => {
        if (deps.onOpen !== undefined) {
          const allowed = await deps.onOpen({ ws, sessionId: d.sessionId, ticket: d.ticket });
          if (!allowed) {
            ws.close(1008, "unauthorized");
            return;
          }
        }
        const peer = peerFromWebSocket(ws);
        peerByWs.set(ws, peer);
        try {
          await deps.hub.attachPeer(d.sessionId, peer, d.ticket);
        } catch {
          ws.close(1008, "invalid ticket");
        }
      })();
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
