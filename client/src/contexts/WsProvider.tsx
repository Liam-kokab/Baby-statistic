import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authStore } from '../utils/authStore';
import { getWsClientId } from '../utils/wsClientId';
import { markResourceDirty, markAllResourcesDirty } from '../utils/resourceCache';
import type { TResource } from '../utils/resourceKeys';

/** Initial delay before the first reconnect attempt after a dropped connection. */
const RECONNECT_BASE_MS = 1000;
/** Reconnect attempts back off exponentially up to this cap. */
const RECONNECT_MAX_MS = 30_000;

type TWsContextValue = {
  /** `true` while a live WebSocket connection to the server is open and authenticated. */
  connected: boolean;
};

const WsContext = createContext<TWsContextValue>({ connected: false });

/** `true` while the app-wide WebSocket is open and authenticated — feeds `DataFreshnessDot`. */
export const useWsConnected = (): boolean => useContext(WsContext).connected;

type TProps = { children: ReactNode };

/**
 * Owns the single, app-wide WebSocket connection to `/ws` — mounted once at the app root (see
 * `main.tsx`), independent of page navigation or the black-screen overlay. Previously every page
 * (and `BlackScreenOverlay`) instantiated its own connection via a since-retired
 * `useBabyUpdatesSocket` hook, so switching pages or opening the always-on-display tore down and
 * reopened the socket every time; now there's exactly one connection for the whole tab.
 *
 * Authenticates by sending `{ type: 'auth', token, clientId }` as the first message right after
 * the connection opens (see `server/src/ws/wsServer.ts`) — deliberately **not** via a `?token=`
 * query param, which would otherwise leak the access token into nginx/proxy access logs and
 * browser devtools/history. `clientId` (`wsClientId.ts`) is a random per-tab ID also sent as the
 * `X-Ws-Client-Id` header on every `authFetch` mutating request, so the server can skip echoing
 * an "update" notification back to the exact tab that caused the change.
 *
 * On every `{ type: 'update', resource }` message, marks the matching cached entries dirty (see
 * `utils/resourceCache.ts`'s `markResourceDirty`) so any currently-mounted `useResource` consumer
 * refetches immediately, and any not-currently-mounted one refetches the next time it mounts. On
 * *any* disconnect — even a momentary drop, reconnected a second later — conservatively marks
 * *every* cached entry dirty (`markAllResourcesDirty`), since an update could have been missed
 * while offline and there's no way to know which resource(s) it touched.
 *
 * Auto-reconnects with exponential backoff on close/error (network drop, server restart, expired
 * token). Also pauses/resumes with the Page Visibility API: the connection is closed as soon as
 * the tab is backgrounded or the screen turns off — no point holding a socket (and its heartbeat)
 * open for a page nobody can see — and reconnects immediately (bypassing backoff) when the tab
 * becomes visible again, also marking everything dirty first (nothing was being notified while
 * paused, so anything could be stale).
 */
export const WsProvider = ({ children }: TProps) => {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false; // true once this effect is cleaned up (app unmount, which never really happens)
    let pausedForVisibility = false; // true while the tab/screen is hidden

    const isPageVisible = (): boolean => document.visibilityState === 'visible';

    const scheduleReconnect = (): void => {
      if (stopped || pausedForVisibility) return;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    const closeSocket = (): void => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      const socket = ws;
      ws = null;
      if (!socket) return;
      if (socket.readyState === WebSocket.CONNECTING) {
        // Per spec, closing a socket that's still mid-handshake aborts the underlying TCP
        // connection abruptly (a RST) instead of a clean close — dev proxies (e.g. Vite) log
        // this as a noisy "ECONNRESET". Wait for the handshake to finish, then close cleanly.
        socket.onopen = (): void => socket.close();
        socket.onclose = null;
        socket.onmessage = null;
        socket.onerror = null;
      } else {
        socket.close();
      }
    };

    const connect = (): void => {
      if (stopped || pausedForVisibility) return;
      const token = authStore.getAccessToken();
      if (!token) {
        scheduleReconnect();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = (): void => {
        attempt = 0;
        ws?.send(JSON.stringify({ type: 'auth', token, clientId: getWsClientId() }));
      };

      ws.onmessage = (event: MessageEvent<string>): void => {
        try {
          const data = JSON.parse(event.data) as { type?: string; resource?: TResource };
          if (data.type === 'auth-ok') setConnected(true);
          if (data.type === 'update') {
            if (data.resource) markResourceDirty(data.resource);
            else markAllResourcesDirty(); // no resource info — be conservative
          }
        } catch {
          // Ignore malformed messages.
        }
      };

      ws.onclose = (): void => {
        setConnected(false);
        markAllResourcesDirty(); // any drop — even momentary — may have missed an update
        scheduleReconnect();
      };

      ws.onerror = (): void => {
        ws?.close();
      };
    };

    const handleVisibilityChange = (): void => {
      if (isPageVisible()) {
        if (!pausedForVisibility) return; // was already active — nothing to do
        pausedForVisibility = false;
        attempt = 0;
        markAllResourcesDirty(); // nothing was being notified while paused — anything could be stale
        connect();
      } else {
        if (pausedForVisibility) return;
        pausedForVisibility = true;
        closeSocket();
        setConnected(false);
      }
    };

    if (isPageVisible()) {
      connect();
    } else {
      pausedForVisibility = true;
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      closeSocket();
    };
  }, []);

  return <WsContext.Provider value={{ connected }}>{children}</WsContext.Provider>;
};

