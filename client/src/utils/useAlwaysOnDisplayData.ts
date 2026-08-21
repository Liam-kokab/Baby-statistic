import { useEffect } from 'react';
import { authFetch } from './authFetch';
import useResource from './useResource';
import type { TAlwaysOnDisplayData } from 'baby-statistic-common';

const CACHE_KEY = '/api/home/always-on-display';
const RESOURCES = ['sleep', 'drankMilk', 'pumping', 'nappy', 'medicine'] as const;

const fetchAlwaysOnDisplayData = () => authFetch<TAlwaysOnDisplayData>(CACHE_KEY);

export type TUseAlwaysOnDisplayDataResult = {
  data: TAlwaysOnDisplayData | null;
  /** `Date.now()` of the last successful fetch, or `null` before the first one completes — feeds `DataFreshnessDot`. */
  lastUpdatedAt: number | null;
  isError: boolean;
};

/**
 * Reads the always-on-display (black screen) data from the shared resource cache (see
 * `useResource`/`resourceCache.ts`), shared across every page (`BlackScreenOverlay` is mounted
 * everywhere). Two things trigger a fetch, both needed:
 * - `enabled: active` — `useResource`'s own dirty-triggered auto-fetch stays live *while the
 *   overlay is open*, so a WebSocket update (or a connection drop) that arrives while it's
 *   already on screen still refreshes the readout in real time, not just on open/close.
 * - An explicit effect that also refetches every time `active` transitions `false → true` (i.e.
 *   every time the overlay opens), regardless of whether the cache considered itself dirty —
 *   this readout is meant to be trustworthy at a glance (e.g. a tablet mounted on the wall), so
 *   opening it shouldn't depend on having correctly received every prior live update.
 * Both can fire on the same open transition without double-fetching — `resourceCache.ts`'s
 * `fetchResource` dedupes concurrent calls for the same key.
 */
const useAlwaysOnDisplayData = (active: boolean): TUseAlwaysOnDisplayDataResult => {
  const { data, lastUpdatedAt, isError, refresh } = useResource(CACHE_KEY, fetchAlwaysOnDisplayData, [...RESOURCES], active);

  useEffect(() => {
    if (active) void refresh();
    // Only re-runs when `active` actually changes value (e.g. false → true on open) — while it
    // stays `true` across unrelated re-renders, `refresh`'s reference doesn't change either, so
    // this doesn't refetch on every render, just once per "the overlay just opened".
  }, [active, refresh]);

  return { data, lastUpdatedAt, isError };
};

export default useAlwaysOnDisplayData;











