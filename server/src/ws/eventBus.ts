import { EventEmitter } from 'events';

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

/** Notify subscribers that data belonging to `babyId` has changed. `originClientId` (from the
 * mutating request's `X-Ws-Client-Id` header, if present) lets subscribers skip notifying the
 * exact tab/connection that caused the change, since it already has fresh data from its own
 * request's response — see `wsServer.ts`. */
export const publishBabyUpdate = (babyId: number, originClientId?: string): void => {
  emitter.emit(BABY_UPDATED_EVENT, babyId, originClientId);
};

/** Subscribe to update notifications for a specific `babyId`. Returns an unsubscribe function. */
export const subscribeBabyUpdates = (
  babyId: number,
  listener: (originClientId?: string) => void
): (() => void) => {
  const handler = (updatedBabyId: number, originClientId?: string): void => {
    if (updatedBabyId === babyId) listener(originClientId);
  };
  emitter.on(BABY_UPDATED_EVENT, handler);
  return () => emitter.off(BABY_UPDATED_EVENT, handler);
};

