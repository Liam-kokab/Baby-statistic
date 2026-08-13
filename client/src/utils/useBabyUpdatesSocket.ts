import { useEffect, useRef, useState } from 'react';
import { authStore } from './authStore';
import { getWsClientId } from './wsClientId';

/** Initial delay before the first reconnect attempt after a dropped connection. */
const RECONNECT_BASE_MS = 1000;
/** Reconnect attempts back off exponentially up to this cap. */
const RECONNECT_MAX_MS = 30_000;
/** On (re)connect, data older than this (or never loaded) is considered stale enough to refetch. */
const STALE_MS = 5 * 60_000;

export type TUseBabyUpdatesSocketResult = {
  /** `true` while a live WebSocket connection to the server is open and authenticated. */
  connected: boolean;
};

/**
 * Opens a WebSocket connection to `/ws` and calls `onUpdate` whenever the server reports that
 * this baby's data has changed. Carries no payload — callers should re-run their existing
 * fetch/refetch logic in `onUpdate`.
 *
 * Authenticates by sending `{ type: 'auth', token, clientId }` as the first message right after
 * the connection opens (see `server/src/ws/wsServer.ts`) — deliberately **not** via a `?token=`
 * query param, which would otherwise leak the access token into nginx/proxy access logs and
 * browser devtools/history. `clientId` (`wsClientId.ts`) is a random per-tab ID also sent as the
 * `X-Ws-Client-Id` header on every `authFetch` mutating request, so the server can skip echoing
 * an "update" notification back to the exact tab that caused the change (it already has fresh
 * data from its own response) while still notifying every other tab/device.
 *
 * Auto-reconnects with exponential backoff on close/error (e.g. network drop, server restart,
 * expired token) — while disconnected, callers should fall back to their existing polling /
 * refetch-on-visible behavior, which is left untouched by this hook. `connected` reflects the
 * current socket state for use in `DataFreshnessDot`.
 *
 * Also pauses/resumes with the Page Visibility API: the connection is closed as soon as the tab
 * is backgrounded or the screen turns off (`document.visibilityState !== 'visible'`) — no point
 * holding a socket (and its 30s heartbeat) open for a page nobody can see, and mobile browsers
 * often suspend/kill background network activity anyway. When the page becomes visible again,
 * `onUpdate` is called once immediately (to pick up anything that changed while disconnected —
 * no notifications are delivered while the socket is closed) and the socket reconnects right
 * away (bypassing the backoff delay).
 *
 * Pass `enabled = false` to close (or never open) the connection — e.g. `BlackScreenOverlay` is
 * mounted on every page but should only hold a live socket open while actually displayed
 * (`useAlwaysOnDisplayData`), not on every page at all times.
 *
 * Closing a socket that's still mid-handshake (`readyState === CONNECTING`) — which can happen
 * e.g. if the tab is hidden again right after a reconnect attempt started — is deferred until the
 * handshake finishes rather than aborting it immediately: aborting mid-handshake sends a raw TCP
 * reset instead of a clean close, which dev proxies (e.g. Vite) surface as noisy `ECONNRESET`
 * errors in the terminal even though nothing is actually broken.
 *
 * Pass `getLastUpdatedAt` (e.g. `() => freshness.lastUpdatedAt` from `useDataFreshness`) to also
 * refetch immediately whenever a connection successfully authenticates (initial connect *or*
 * reconnect) if the data is already stale (`null`, or older than 5 minutes) — covers the case
 * where the server itself was offline/restarting for a while: no "update" notification is ever
 * missed while genuinely disconnected (there's nothing to miss), but the data on screen could
 * still be old by the time the connection comes back, so it's worth checking on every successful
 * (re)connect rather than only reacting to explicit "update" messages. Omit it to skip this check
 * entirely (e.g. `useAlwaysOnDisplayData`, which has its own freshness-agnostic polling fallback).
 */
const useBabyUpdatesSocket = (
  onUpdate: () => void,
  enabled: boolean = true,
  getLastUpdatedAt?: () => number | null
): TUseBabyUpdatesSocketResult => {
  const [connected, setConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  const getLastUpdatedAtRef = useRef(getLastUpdatedAt);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    getLastUpdatedAtRef.current = getLastUpdatedAt;
  });

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false; // true once this effect is cleaned up (unmount, or `enabled` flips off)
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
          const data = JSON.parse(event.data) as { type?: string };
          if (data.type === 'auth-ok') {
            setConnected(true);
            const lastUpdatedAt = getLastUpdatedAtRef.current?.();
            if (lastUpdatedAt !== undefined && (lastUpdatedAt === null || Date.now() - lastUpdatedAt > STALE_MS)) {
              onUpdateRef.current(); // data was already stale — the server may have been offline for a while
            }
          }
          if (data.type === 'update') onUpdateRef.current();
        } catch {
          // Ignore malformed messages — no data is ever carried, so worst case we miss a refetch.
        }
      };

      ws.onclose = (): void => {
        setConnected(false);
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
        onUpdateRef.current(); // catch up on anything missed while disconnected
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
  }, [enabled]);

  return { connected };
};

export default useBabyUpdatesSocket;

