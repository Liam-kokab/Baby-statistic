/**
 * A random ID generated once per tab/page-load, used to tell the server "this WebSocket
 * connection, and these mutating HTTP requests, came from the same browser tab" — so it can
 * skip sending a "data changed" WebSocket notification back to the exact tab that caused the
 * change (that tab already has fresh data from its own request's response), while still
 * notifying every other tab/device (even ones logged in as the same user). See
 * `contexts/WsProvider.tsx` (sends this as part of the WS auth message) and `authFetch.ts`
 * (sends this as the `X-Ws-Client-Id` header on every request).
 *
 * Deliberately module-scoped (not persisted to storage) — a fresh page load means a fresh ID,
 * which is fine: a full reload already re-fetches everything from scratch anyway.
 */
let clientId: string | null = null;

export const getWsClientId = (): string => {
  if (clientId === null) clientId = crypto.randomUUID();
  return clientId;
};

