import { useCallback, useEffect, useState } from 'react';
import { authFetch } from './authFetch';
import useBabyUpdatesSocket from './useBabyUpdatesSocket';
import type { TAlwaysOnDisplayData } from 'baby-statistic-common';

const POLL_MS = 5 * 60_000;

/**
 * Fetches the always-on-display (black screen) data as soon as `active` becomes true, and
 * immediately whenever the server reports this baby's data changed via `useBabyUpdatesSocket`
 * (e.g. another device logs a feed/pump/sleep event while this display is up) — only while
 * `active`, so idle pages don't hold an extra WebSocket connection open just for this. Falls back
 * to polling every 5 minutes only while the WebSocket is disconnected — once it's connected, live
 * updates make the poll redundant, so it's skipped entirely. Used to keep the black-screen
 * readout fresh on every page: once when it turns on, then live (or polling, as a fallback) after
 * that.
 */
const useAlwaysOnDisplayData = (active: boolean): TAlwaysOnDisplayData | null => {
  const [data, setData] = useState<TAlwaysOnDisplayData | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const res = await authFetch<TAlwaysOnDisplayData>('/api/home/always-on-display');
    if (res.ok) setData(res.data);
  }, []);

  const { connected } = useBabyUpdatesSocket(load, active);

  // Always fetch once as soon as the overlay turns on, regardless of the (still-connecting) WS state.
  useEffect(() => {
    if (!active) return;
    void load();
  }, [active, load]);

  // Recurring poll fallback — only needed while the WebSocket is disconnected.
  useEffect(() => {
    if (!active || connected) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [active, connected, load]);

  return data;
};

export default useAlwaysOnDisplayData;



