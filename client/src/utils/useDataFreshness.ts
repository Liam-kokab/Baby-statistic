import { useCallback, useState } from 'react';

export type TDataFreshness = {
  /** `Date.now()` timestamp of the last successful data refresh, or `null` before the first load completes. */
  lastUpdatedAt: number | null;
  /** `true` if the most recent fetch attempt failed (data may be stale/wrong). */
  isError: boolean;
  /**
   * `true` if a live `useBabyUpdatesSocket` WebSocket connection is currently open for this
   * page's baby — takes priority over the age-based coloring in `DataFreshnessDot` (green).
   * Omitted/`false` on pages that don't wire up the socket, or while it's disconnected (falls
   * back to the existing polling/age-based coloring).
   */
  wsConnected?: boolean;
};

export type TUseDataFreshnessResult = TDataFreshness & {
  /** Call after a successful data fetch — records "now" and clears any error flag. */
  reportSuccess: () => void;
  /** Call after a failed data fetch — keeps the last known `lastUpdatedAt` but flags the error. */
  reportError: () => void;
};

/**
 * Tracks how recently a page's data was successfully refreshed, for the freshness dot shown
 * in `PageLayout`'s (and `HomePage`'s) banner via `DataFreshnessDot`. Instantiate once per page,
 * call `reportSuccess()`/`reportError()` from the page's own load function(s), and pass the
 * result through as the `dataFreshness` prop.
 */
const useDataFreshness = (): TUseDataFreshnessResult => {
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  const reportSuccess = useCallback((): void => {
    setLastUpdatedAt(Date.now());
    setIsError(false);
  }, []);

  const reportError = useCallback((): void => {
    setIsError(true);
  }, []);

  return { lastUpdatedAt, isError, reportSuccess, reportError };
};

export default useDataFreshness;

