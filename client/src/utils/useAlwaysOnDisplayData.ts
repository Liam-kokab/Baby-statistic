import { useEffect, useState } from 'react';
import { authFetch } from './authFetch';
import type { TAlwaysOnDisplayData } from 'baby-statistic-common';

const POLL_MS = 5 * 60_000;

/**
 * Fetches the always-on-display (black screen) data as soon as `active` becomes true, then
 * again every 5 minutes while it stays true. Used to keep the black-screen readout fresh on
 * every page: once when it turns on, and periodically after that.
 */
const useAlwaysOnDisplayData = (active: boolean): TAlwaysOnDisplayData | null => {
  const [data, setData] = useState<TAlwaysOnDisplayData | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const load = async (): Promise<void> => {
      const res = await authFetch<TAlwaysOnDisplayData>('/api/home/always-on-display');
      if (!cancelled && res.ok) setData(res.data);
    };

    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  return data;
};

export default useAlwaysOnDisplayData;

