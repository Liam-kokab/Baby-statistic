import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { TDataOrError } from 'baby-statistic-common';
import {
  getResourceEntry,
  subscribeResourceEntry,
  registerResourceDependencies,
  fetchResource,
  isEntryDirty,
} from './resourceCache';
import type { TResource } from './resourceKeys';

export type TUseResourceResult<T> = {
  /** Cached data — populated instantly (no loading flash) on remount if already fetched and not
   * marked dirty since. `null` before the first successful fetch. */
  data: T | null;
  isError: boolean;
  loading: boolean;
  /** `Date.now()` of the last successful fetch, or `null` before the first one completes. */
  lastUpdatedAt: number | null;
  /** Forces a refetch regardless of the cache's dirty state (e.g. after this page's own mutating
   * action, or a manual pull-to-refresh). */
  refresh: () => Promise<void>;
};

/**
 * Reads (and keeps fresh) a globally-cached resource, keyed by `key` (e.g. an endpoint + query
 * string), shared across every component/page mount for the lifetime of the tab — see
 * `resourceCache.ts`. Fetches once via `fetcher` on first use, and again whenever the entry is
 * marked dirty: a matching `resource` changed via a WebSocket `update` message, or the socket
 * dropped for even a moment (see `WsProvider`/`markAllResourcesDirty`). Revisiting a page whose
 * cache entry is still clean shows the cached data immediately with no network round-trip.
 *
 * Pass `enabled = false` to skip the automatic dirty-triggered fetch entirely (e.g. while some
 * other condition means this data shouldn't be actively kept warm at all) — `refresh()` still
 * works on demand regardless of `enabled`.
 *
 * Also retries once on mount if the entry's last attempt failed (`isError`) — a failed fetch
 * doesn't otherwise leave the entry dirty (see `fetchResource`'s doc comment), so without this a
 * page revisited after a transient failure would keep showing the stale error indefinitely.
 */
const useResource = <T,>(
  key: string,
  fetcher: () => Promise<TDataOrError<T>>,
  resources: TResource[],
  enabled: boolean = true
): TUseResourceResult<T> => {
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const resourcesKey = resources.join(',');
  useEffect(() => {
    registerResourceDependencies(key, resources);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, resourcesKey]);

  const subscribe = useCallback((onStoreChange: () => void) => subscribeResourceEntry(key, onStoreChange), [key]);
  const getSnapshot = useCallback(() => getResourceEntry<T>(key), [key]);
  const entry = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refresh = useCallback((): Promise<void> => fetchResource(key, () => fetcherRef.current()), [key]);

  useEffect(() => {
    if (enabled && isEntryDirty(entry)) void refresh();
    // Depends on the whole `entry` object (not just its dirty-ness) so a *repeated* dirty mark —
    // e.g. several WebSocket reconnect attempts in a row while genuinely offline — retries the
    // fetch each time too, instead of only once when it first becomes dirty.
  }, [entry, enabled, refresh]);

  // A failed fetch deliberately does *not* leave the entry "dirty" (see fetchResource's doc
  // comment — otherwise a persistently-failing endpoint would be hammered on every render), so
  // the effect above won't retry it on its own. But simply mounting this hook again later (e.g.
  // navigating back to a page after a transient network blip) is a reasonable, low-frequency
  // moment to give it one more try — matching the old per-page "always refetch on mount"
  // behavior for this one case. Runs at most once per mount, so it can't loop.
  const hasRetriedOnMountRef = useRef(false);
  useEffect(() => {
    if (hasRetriedOnMountRef.current) return;
    hasRetriedOnMountRef.current = true;
    if (enabled && entry.isError) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data: entry.data, isError: entry.isError, loading: entry.loading, lastUpdatedAt: entry.lastUpdatedAt, refresh };
};

export default useResource;





