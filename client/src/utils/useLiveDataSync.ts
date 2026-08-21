import { useState } from 'react';
import { useWsConnected } from '../contexts/WsProvider';
import useResourceListener from './useResourceListener';
import useRefetchOnVisible from './useRefetchOnVisible';
import type { TDataFreshness } from './useDataFreshness';
import type { TResource } from './resourceKeys';

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
 * - Reads `connected` from the single app-wide `WsProvider` (see `contexts/WsProvider.tsx`) —
 *   pages no longer own their own socket, so opening the black screen or navigating away never
 *   tears down/reopens a connection.
 * - Calls `onListUpdate` whenever one of `resources` changes (a live WebSocket "update", or the
 *   connection dropped for even a moment) — paused while the black screen is open, so a single
 *   update doesn't also trigger this (hidden) page's refetch alongside `BlackScreenOverlay`'s own.
 *   Typically used to refresh a page's paginated list (`useTimeWindowScroll`'s `refresh()`); the
 *   page's own cached summary (`useResource`) already reacts to the same resources on its own.
 * - Falls back to `useRefetchOnVisible`'s polling/stale-timer/tab-visibility refetch only while
 *   the black screen is open, or the WebSocket is disconnected — once it's connected, live
 *   "update" notifications make that polling redundant.
 * - Merges `wsConnected` into the given `freshness` for `DataFreshnessDot`.
 */
const useLiveDataSync = (
  resources: TResource[],
  onListUpdate: () => void,
  freshness: Pick<TDataFreshness, 'lastUpdatedAt' | 'isError'>
): TUseLiveDataSyncResult => {
  const [isBlackScreenOpen, setIsBlackScreenOpen] = useState(false);
  const wsConnected = useWsConnected();

  useResourceListener(resources, () => {
    if (!isBlackScreenOpen) onListUpdate();
  });

  const visibilityRef = useRefetchOnVisible(onListUpdate, undefined, !isBlackScreenOpen && !wsConnected);

  return {
    visibilityRef,
    dataFreshness: { lastUpdatedAt: freshness.lastUpdatedAt, isError: freshness.isError, wsConnected },
    onBlackScreenOpenChange: setIsBlackScreenOpen,
  };
};

export default useLiveDataSync;



