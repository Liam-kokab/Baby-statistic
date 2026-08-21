/**
 * Coarse-grained resource key describing *what kind* of data changed — mirrors the server's
 * `TResource` type (`server/src/ws/eventBus.ts`), sent as the `resource` field on the WebSocket
 * `update` message (see `contexts/WsProvider.tsx`) so the client can invalidate only the
 * matching cached entries (`utils/resourceCache.ts`) instead of everything. `pee`/`poop` share
 * the `nappy` key, matching the combined `/api/nappy` read route.
 */
export type TResource = 'servedMilk' | 'drankMilk' | 'sleep' | 'nappy' | 'medicine' | 'pumping' | 'milestone';

// Mirrors the server's `ROUTE_TO_RESOURCE` (server/src/index.ts) — maps a mutating request's
// first `/api/<segment>` path piece to the resource it affects. `pee`/`poop` collapse into
// `nappy`, matching the combined `/api/nappy` read route. Routes not listed here (auth, admin,
// baby, backup, build-time, ping, predictions, app-events) aren't cached "live" event data.
const ROUTE_TO_RESOURCE: Partial<Record<string, TResource>> = {
  'served-milk': 'servedMilk',
  'drank-milk': 'drankMilk',
  sleep: 'sleep',
  pee: 'nappy',
  poop: 'nappy',
  nappy: 'nappy',
  medicine: 'medicine',
  pumping: 'pumping',
  milestones: 'milestone',
};

/**
 * Derives the `TResource` a request URL affects (e.g. `/api/drank-milk/waste` → `drankMilk`), or
 * `undefined` if it doesn't map to any cached resource. Used by `authFetch` to mark the matching
 * cache entries dirty immediately after this tab's own mutating requests — needed on top of (not
 * instead of) the server's WebSocket broadcast: the server skips echoing an `update` back to the
 * tab that caused it (see `wsClientId.ts`), which was safe under the old per-page-refetch design
 * but would otherwise leave *other* pages' already-cached data for the same resource stale within
 * the same tab (e.g. toggle sleep on `HomePage`, then open `SleepPage` — its cached summary
 * wouldn't know anything changed without this).
 */
export const getResourceForUrl = (url: string): TResource | undefined => {
  const path = url.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  const resourceSegment = apiIndex >= 0 ? segments[apiIndex + 1] : undefined;
  return resourceSegment ? ROUTE_TO_RESOURCE[resourceSegment] : undefined;
};

