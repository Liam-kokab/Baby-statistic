import type { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken } from '../services/authService';
import { subscribeBabyUpdates } from './eventBus';

const WS_PATH = '/ws';
/** Ping interval to detect and clean up dead connections (browsers/proxies can drop TCP silently). */
const HEARTBEAT_MS = 30_000;
/** A connection must send its auth message within this window of connecting, or it's closed. */
const AUTH_TIMEOUT_MS = 5_000;

type TAliveSocket = WebSocket & { isAlive?: boolean };

type TAuthMessage = { type: 'auth'; token: string; clientId?: string };

const isAuthMessage = (value: unknown): value is TAuthMessage =>
  typeof value === 'object' && value !== null &&
  (value as Record<string, unknown>).type === 'auth' &&
  typeof (value as Record<string, unknown>).token === 'string';

/**
 * Attaches a WebSocket server (path `/ws`) to the given HTTP server. Deliberately does **not**
 * accept the JWT access token as a `?token=` query-string param on the upgrade request — query
 * strings end up in nginx/proxy access logs, browser devtools, and potentially history, which
 * would leak a live (if short-lived) bearer token. Instead, the connection is accepted
 * unauthenticated and the client must send `{ "type": "auth", "token": "<accessToken>" }` as its
 * first WebSocket message within `AUTH_TIMEOUT_MS`; only after that message is verified does the
 * connection get scoped to a `babyId` and start receiving update notifications. Connections that
 * never authenticate in time, or send an invalid token, are closed — no data is ever sent to them.
 *
 * The auth message may also include a `clientId` — a random per-tab ID the client generates once
 * (see `client/src/utils/wsClientId.ts`) and also sends as the `X-Ws-Client-Id` header on every
 * mutating HTTP request. When that connection's `clientId` matches the `originClientId` carried
 * by an update notification (see `eventBus.ts`), the notification is skipped for that connection
 * only — the tab that caused the change already has fresh data from its own request's response,
 * so re-notifying it would just trigger a redundant refetch. Every other connection (other tabs,
 * other devices, even other tabs logged in as the same username) still gets notified normally.
 *
 * The same `clientId` also dedupes connections: only one live connection per `clientId` is kept
 * (`connectionsByClientId`). If a tab reconnects (e.g. after being backgrounded, or a page
 * navigation) before its old socket's close frame ever reached the server — common on mobile
 * browsers, which can suspend a hidden tab's network activity before it gets a chance to send
 * one — the new connection immediately terminates the stale one on auth, instead of waiting for
 * the next heartbeat cycle (up to `HEARTBEAT_MS * 2`) to notice it's dead.
 */
export const attachWebSocketServer = (server: HttpServer): void => {
  const wss = new WebSocketServer({ noServer: true });
  const connectionsByClientId = new Map<string, TAliveSocket>();

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (url.pathname !== WS_PATH) return; // let other upgrade handlers (if any) deal with it

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: TAliveSocket) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let unsubscribe: (() => void) | null = null;
    let authenticated = false;
    let myClientId: string | undefined;

    const authTimeout = setTimeout(() => {
      if (!authenticated) ws.close();
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (raw) => {
      if (authenticated) return; // no other messages are expected once authenticated
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        ws.close();
        return;
      }
      if (!isAuthMessage(parsed)) {
        ws.close();
        return;
      }
      try {
        const payload = verifyAccessToken(parsed.token);
        if (!payload.babyId) {
          ws.close();
          return;
        }
        myClientId = parsed.clientId;
        authenticated = true;
        clearTimeout(authTimeout);

        if (myClientId) {
          const existing = connectionsByClientId.get(myClientId);
          if (existing && existing !== ws) existing.terminate(); // stale connection from the same tab
          connectionsByClientId.set(myClientId, ws);
        }

        unsubscribe = subscribeBabyUpdates(payload.babyId, (originClientId) => {
          if (myClientId && originClientId === myClientId) return; // skip echo to the tab that caused it
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'update' }));
        });
        ws.send(JSON.stringify({ type: 'auth-ok' }));
      } catch {
        ws.close();
      }
    });

    const cleanup = (): void => {
      clearTimeout(authTimeout);
      unsubscribe?.();
      if (myClientId && connectionsByClientId.get(myClientId) === ws) {
        connectionsByClientId.delete(myClientId);
      }
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws: TAliveSocket) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_MS);

  wss.on('close', () => clearInterval(heartbeat));
};

