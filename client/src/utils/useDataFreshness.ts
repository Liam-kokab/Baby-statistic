export type TDataFreshness = {
  /** `Date.now()` timestamp of the last successful data refresh, or `null` before the first load completes. */
  lastUpdatedAt: number | null;
  /** `true` if the most recent fetch attempt failed (data may be stale/wrong). */
  isError: boolean;
  /**
   * `true` if the single app-wide WebSocket connection (`contexts/WsProvider.tsx`) is currently
   * open — takes priority over the age-based coloring in `DataFreshnessDot` (green). Omitted/
   * `false` while it's disconnected (falls back to the existing age-based coloring).
   */
  wsConnected?: boolean;
};


