import { useState, useEffect, useRef, useCallback } from 'react';
import type { TWishedResult } from 'baby-statistic-common';

// ── Week-alignment helpers (exported for use in pages) ────────────────────────

/** Returns the ISO date string of this week's Sunday, or today if today IS Sunday. */
export const getWindowEnd = (filterTo: string): string => {
  const d = new Date(filterTo);
  const day = d.getDay(); // 0 = Sun
  if (day === 0) return filterTo;
  const sun = new Date(d);
  sun.setDate(d.getDate() + (7 - day));
  return sun.toISOString().slice(0, 10);
};

// ── Hook ──────────────────────────────────────────────────────────────────────

type TUseTimeWindowScrollReturn<T> = {
  data: T[];
  loading: boolean;
  hasMore: boolean;
  /** Attach to the item at index `data.length - 10` to trigger the next load. */
  sentinelRef: (el: Element | null) => void;
  /** Reset and reload from the most recent week. */
  refresh: () => void;
};

/**
 * Infinite-scroll hook that delegates window expansion to the server via the
 * `wished` query param. `fetchWindow` must pass `wished` and return
 * `TWishedResult<T>` (`{ items, actualFrom }`).
 *
 * @param filterFrom   - Oldest date the user wants (YYYY-MM-DD); passed to server as boundary.
 * @param filterTo     - Upper bound date (YYYY-MM-DD); first window ends on the Sunday of this week.
 * @param fetchWindow  - Called with (fromISO, toISO) full datetime strings; returns TWishedResult.
 * @param hasEnough    - Predicate; keep loading until it returns true or boundary is reached.
 *                       Memoize with useCallback so it only changes when the view changes.
 */
const useTimeWindowScroll = <T>(
  filterFrom: string,
  filterTo: string,
  fetchWindow: (from: string, to: string) => Promise<TWishedResult<T>>,
  hasEnough: (items: T[]) => boolean = (items) => items.length >= 10,
): TUseTimeWindowScrollReturn<T> => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedFrom, setLoadedFrom] = useState('');
  const [resetCount, setResetCount] = useState(0);

  const loadingRef = useRef(false);
  const genRef = useRef(0);
  // Refs for values used inside loadWindow's async loop (avoids stale closures)
  const fetchWindowRef = useRef<(from: string, to: string) => Promise<TWishedResult<T>>>(fetchWindow);
  fetchWindowRef.current = fetchWindow;
  const hasEnoughRef = useRef(hasEnough);
  hasEnoughRef.current = hasEnough;
  /** Mirrors data state — updated synchronously before setData so the loop can check totals. */
  const dataRef = useRef<T[]>([]);

  const hasMore = loadedFrom !== '' && loadedFrom > filterFrom;

  const refresh = useCallback((): void => {
    setResetCount((c) => c + 1);
  }, []);

  /**
   * Fetches one window [from, to] and, if `hasEnough` is still unsatisfied,
   * keeps fetching earlier windows in a loop — all within a single async call.
   */
  const loadWindow = useCallback(
    async (from: string, to: string, append: boolean, gen: number): Promise<void> => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);

      // On a fresh (non-append) load, reset the running accumulator
      if (!append) dataRef.current = [];

      let currentTo = to;

      for (;;) {
        const result = await fetchWindowRef.current(`${from}T00:00:00`, `${currentTo}T23:59:59`);

        if (genRef.current !== gen) {
          // A newer load was started — discard this result
          loadingRef.current = false;
          setLoading(false);
          return;
        }

        const newData = [...dataRef.current, ...result.items];
        dataRef.current = newData;
        setData(newData);
        setLoadedFrom(result.actualFrom);

        // Stop when enough groups are loaded, or we've hit the filter boundary
        const canGoFurther = result.actualFrom > from.slice(0, 10);
        if (!canGoFurther || hasEnoughRef.current(newData)) break;

        // Advance to the window immediately before actualFrom
        const prevDate = new Date(`${result.actualFrom}T12:00:00`);
        prevDate.setDate(prevDate.getDate() - 1);
        currentTo = prevDate.toISOString().slice(0, 10);
      }

      loadingRef.current = false;
      setLoading(false);
    },
    [],
  );

  // Reset and load first window whenever filters or refreshKey change.
  useEffect(() => {
    genRef.current += 1;
    const gen = genRef.current;
    loadingRef.current = false;
    dataRef.current = [];
    setData([]);
    setLoadedFrom('');
    const windowEnd = getWindowEnd(filterTo);
    loadWindow(filterFrom, windowEnd, false, gen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo, resetCount]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingRef.current) return;
    if (loadedFrom === '' || loadedFrom <= filterFrom) return;
    genRef.current += 1;
    const gen = genRef.current;
    // to = day before loadedFrom (Sunday of the previous window)
    const prevDate = new Date(`${loadedFrom}T12:00:00`);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDay = prevDate.toISOString().slice(0, 10);
    await loadWindow(filterFrom, prevDay, true, gen);
  }, [loadedFrom, filterFrom, loadWindow]);

  // Re-trigger when hasEnough changes (e.g. user switches view) and current
  // data is still insufficient.  The loop inside loadWindow handles the rest.
  useEffect(() => {
    if (!loadingRef.current && hasMore && !hasEnoughRef.current(dataRef.current)) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEnough]); // only re-runs when the hasEnough function itself changes

  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (el: Element | null): void => {
      observerRef.current?.disconnect();
      if (!el) return;
      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) loadMore();
        },
        { threshold: 0 },
      );
      observerRef.current.observe(el);
    },
    [loadMore],
  );

  return { data, loading, hasMore, sentinelRef, refresh };
};

export default useTimeWindowScroll;
