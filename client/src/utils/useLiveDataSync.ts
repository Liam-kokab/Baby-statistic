import { useState } from 'react';
import useBabyUpdatesSocket from './useBabyUpdatesSocket';
import useRefetchOnVisible from './useRefetchOnVisible';
import type { TDataFreshness, TUseDataFreshnessResult } from './useDataFreshness';

export type TUseLiveDataSyncResult = {
  /** Pass to `PageLayout`'s `ref` prop (or a wrapping `<div ref={...}>`) to drive the
   * IntersectionObserver/stale-timer/tab-visibility refetch fallback. */
  visibilityRef: ReturnType<typeof useRefetchOnVisible>;
  /** Pass to `PageLayout`'s `dataFreshness` prop to drive `DataFreshnessDot`. */
  dataFreshness: TDataFreshness;
  /** Pass to `PageLayout`'s `onBlackScreenOpenChange` prop. */
  onBlackScreenOpenChange: (isOpen: boolean) => void;
};

/**
 * Wires up the "live update" pattern shared by every data page that uses `PageLayout`'s
 * `dataFreshness`/`onBlackScreenOpenChange` props:
 * - Tracks whether the black-screen overlay is currently open (via `onBlackScreenOpenChange`).
 * - Opens a `useBabyUpdatesSocket` connection — paused while the black screen is open (see
 *   `PageLayout`'s `onBlackScreenOpenChange` doc comment for why) — calling `onUpdate` on every
 *   "this baby's data changed" notification, and also immediately on (re)connect if `freshness`
 *   is already stale (covers the server having been offline for a while).
 * - Falls back to `useRefetchOnVisible`'s polling/stale-timer/tab-visibility refetch only while
 *   the black screen is open, or the WebSocket is disconnected — once it's connected, live
 *   "update" notifications make that polling redundant.
 * - Merges `wsConnected` into `freshness` for `DataFreshnessDot`.
 *
 * Extracted from the identical block previously duplicated across `MedicinePage`,
 * `MilestonePage`, `MilkDrankPage`, `MilkSavedPage`, `PoopPeePage`, `PumpingPage`, and
 * `SleepPage`. `HomePage` wires the same pieces up manually instead, since it has its own
 * `useBlackScreen` call (no separate `isBlackScreenOpen` state needed there).
 */
const useLiveDataSync = (onUpdate: () => void, freshness: TUseDataFreshnessResult): TUseLiveDataSyncResult => {
  const [isBlackScreenOpen, setIsBlackScreenOpen] = useState(false);
  const { connected: wsConnected } = useBabyUpdatesSocket(onUpdate, !isBlackScreenOpen, () => freshness.lastUpdatedAt);
  const visibilityRef = useRefetchOnVisible(onUpdate, undefined, !isBlackScreenOpen && !wsConnected);

  return {
    visibilityRef,
    dataFreshness: { lastUpdatedAt: freshness.lastUpdatedAt, isError: freshness.isError, wsConnected },
    onBlackScreenOpenChange: setIsBlackScreenOpen,
  };
};

export default useLiveDataSync;

