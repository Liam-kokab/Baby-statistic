import { EventEmitter } from 'events';

/**
 * Coarse-grained resource key describing *what kind* of data changed, derived from the
 * mutating route's path (see `index.ts`) and forwarded to clients on the `update` WebSocket
 * message so they can invalidate only the matching cached data instead of everything (see
 * `client/src/utils/resourceCache.ts`). `pee`/`poop` share the `nappy` key, matching the
 * combined `/api/nappy` read route.
 */
export type TResource = 'servedMilk' | 'drankMilk' | 'sleep' | 'nappy' | 'medicine' | 'pumping' | 'milestone';

/**
 * Process-local pub/sub for "this baby's data changed" notifications.
 *
 * The server runs as a single PM2 fork process (see ecosystem.config.js — no cluster
 * mode), so a plain in-process EventEmitter is sufficient; no Redis or other external
 * broker is needed. If the server is ever scaled to multiple instances, this module is
 * the single place to swap in a real pub/sub backend (e.g. Redis) without touching
 * callers.
 */
const BABY_UPDATED_EVENT = 'baby-updated';

const emitter = new EventEmitter();
// Many pages/tabs can subscribe to the same babyId concurrently.
emitter.setMaxListeners(0);

/** Notify subscribers that data belonging to `babyId` has changed. `resource` (when known) lets
 * clients invalidate only the matching cached data. `originClientId` (from the mutating
 * request's `X-Ws-Client-Id` header, if present) lets subscribers skip notifying the exact
 * tab/connection that caused the change, since it already has fresh data from its own request's
 * response — see `wsServer.ts`. */
export const publishBabyUpdate = (babyId: number, resource?: TResource, originClientId?: string): void => {
  emitter.emit(BABY_UPDATED_EVENT, babyId, resource, originClientId);
};

/** Subscribe to update notifications for a specific `babyId`. Returns an unsubscribe function. */
export const subscribeBabyUpdates = (
  babyId: number,
  listener: (resource?: TResource, originClientId?: string) => void
): (() => void) => {
  const handler = (updatedBabyId: number, resource?: TResource, originClientId?: string): void => {
    if (updatedBabyId === babyId) listener(resource, originClientId);
  };
  emitter.on(BABY_UPDATED_EVENT, handler);
  return () => emitter.off(BABY_UPDATED_EVENT, handler);
};

