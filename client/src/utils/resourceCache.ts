import type { TDataOrError } from 'baby-statistic-common';
import type { TResource } from './resourceKeys';

type TResourceCacheEntry<T> = {
  data: T | null;
  isError: boolean;
  loading: boolean;
  /** `Date.now()` of the last successful fetch, or `null` before the first one completes. */
  lastUpdatedAt: number | null;
  /**
   * Incremented every time this entry is marked dirty (see `markResourceDirty`/
   * `markAllResourcesDirty`). Compared against `fetchedVersion` to derive staleness — using a
   * version counter instead of a plain boolean means a *new* dirty mark that arrives while a
   * fetch is already in flight (or right after one just failed) is never silently swallowed,
   * while a fetch's own loading/error state changes don't themselves look like a new dirty event
   * and re-trigger an immediate retry loop. Starts at `1` so a freshly-created entry is dirty.
   */
  dirtyVersion: number;
  /** `dirtyVersion` as of the start of the most recent fetch attempt. */
  fetchedVersion: number;
  /** Which server `resource`(s) this entry depends on — used to route `markResourceDirty` calls. */
  resources: TResource[];
};

type TListener = () => void;

/** Module-level — deliberately not component state, so it survives page navigation (unmount)
 * for the lifetime of the tab. Cleared on logout via `clearResourceCache`. */
const cache = new Map<string, TResourceCacheEntry<unknown>>();
const listeners = new Map<string, Set<TListener>>();
const inflight = new Map<string, Promise<void>>();

const notify = (key: string): void => {
  listeners.get(key)?.forEach((listener) => listener());
};

const emptyEntry = <T,>(resources: TResource[]): TResourceCacheEntry<T> => ({
  data: null,
  isError: false,
  loading: false,
  lastUpdatedAt: null,
  dirtyVersion: 1,
  fetchedVersion: 0,
  resources,
});

/** `true` if `entry`'s data might be stale and should be refetched — either it was never fetched,
 * a matching `resource` changed, or the WebSocket dropped for even a moment. */
export const isEntryDirty = <T,>(entry: TResourceCacheEntry<T>): boolean => entry.dirtyVersion !== entry.fetchedVersion;

/** Returns the cache entry for `key`, creating an empty (dirty) one on first access. */
export const getResourceEntry = <T,>(key: string): TResourceCacheEntry<T> => {
  const existing = cache.get(key) as TResourceCacheEntry<T> | undefined;
  if (existing) return existing;
  const created = emptyEntry<T>([]);
  cache.set(key, created);
  return created;
};

/** Subscribe to changes on a single cache entry. Returns an unsubscribe function. */
export const subscribeResourceEntry = (key: string, listener: TListener): (() => void) => {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  return () => set?.delete(listener);
};

const patchEntry = <T,>(key: string, patch: Partial<TResourceCacheEntry<T>>): void => {
  const current = getResourceEntry<T>(key);
  cache.set(key, { ...current, ...patch });
  notify(key);
};

/** Associates `key` with the server `resource`(s) it depends on — called by `useResource` so
 * later `markResourceDirty` calls know which entries to invalidate. Safe to call repeatedly. */
export const registerResourceDependencies = (key: string, resources: TResource[]): void => {
  const current = getResourceEntry(key);
  if (resources.every((r) => current.resources.includes(r))) return; // already up to date
  patchEntry(key, { resources: Array.from(new Set([...current.resources, ...resources])) });
};

// Lightweight, non-persistent pub/sub for consumers that don't back onto a cached `useResource`
// entry — e.g. the paginated infinite-scroll lists (`useTimeWindowScroll`), which already refetch
// their own current window on every mount, so they only need an imperative "refresh now" signal
// while already mounted (no dirty-flag persistence needed — see `useResourceListener`).
const resourceKindListeners = new Map<TResource, Set<TListener>>();
const anyResourceListeners = new Set<TListener>();

/** Subscribe to "this resource kind changed" events. Returns an unsubscribe function. */
export const subscribeResourceKind = (resource: TResource, listener: TListener): (() => void) => {
  let set = resourceKindListeners.get(resource);
  if (!set) {
    set = new Set();
    resourceKindListeners.set(resource, set);
  }
  set.add(listener);
  return () => set?.delete(listener);
};

/** Subscribe to "some resource changed, or the connection dropped" events, regardless of kind —
 * used for the disconnect fallback, where any resource could have been missed. */
export const subscribeAnyResourceChange = (listener: TListener): (() => void) => {
  anyResourceListeners.add(listener);
  return () => anyResourceListeners.delete(listener);
};

/** Marks every cached entry that depends on `resource` as dirty, and notifies any imperative
 * `subscribeResourceKind` listeners for it. */
export const markResourceDirty = (resource: TResource): void => {
  cache.forEach((entry, key) => {
    if (entry.resources.includes(resource)) patchEntry(key, { dirtyVersion: entry.dirtyVersion + 1 });
  });
  resourceKindListeners.get(resource)?.forEach((listener) => listener());
};

/** Marks *every* cached entry dirty — used when the WebSocket drops (even momentarily), since a
 * missed `update` message could have touched any resource and there's no way to know which. Also
 * notifies every imperative listener (`subscribeAnyResourceChange`). */
export const markAllResourcesDirty = (): void => {
  cache.forEach((entry, key) => patchEntry(key, { dirtyVersion: entry.dirtyVersion + 1 }));
  anyResourceListeners.forEach((listener) => listener());
};

/** Wipes the entire cache — called on logout so no data lingers into the next login/account. */
export const clearResourceCache = (): void => {
  const keys = Array.from(cache.keys());
  cache.clear();
  inflight.clear();
  keys.forEach(notify);
};

/**
 * Runs `fetcher` and updates the cache entry for `key`, deduping concurrent calls (a second
 * caller while one is already in flight just awaits the same promise instead of double-fetching).
 * Records `fetchedVersion = dirtyVersion` at the *start* of the attempt (success or failure) —
 * so a fetch that fails is still considered "handled" for that version (no infinite retry loop
 * on every render), while a *new* dirty mark that arrives during/after the attempt (a genuinely
 * new update, or another reconnect-drop cycle) correctly leaves the entry dirty again afterwards.
 */
export const fetchResource = <T,>(key: string, fetcher: () => Promise<TDataOrError<T>>): Promise<void> => {
  const existing = inflight.get(key);
  if (existing) return existing;

  const startVersion = getResourceEntry<T>(key).dirtyVersion;
  patchEntry<T>(key, { loading: true, fetchedVersion: startVersion });
  const run = (async (): Promise<void> => {
    const result = await fetcher();
    if (result.ok) {
      patchEntry<T>(key, { data: result.data, isError: false, lastUpdatedAt: Date.now(), loading: false });
    } else {
      patchEntry<T>(key, { isError: true, loading: false });
    }
  })().finally(() => inflight.delete(key));

  inflight.set(key, run);
  return run;
};
