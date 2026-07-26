import { useEffect, useRef, useCallback } from 'react';

const STALE_MS = 5 * 60_000;
const STALE_CHECK_INTERVAL_MS = 30_000;

/**
 * Calls `refetch` whenever:
 * 1. The observed element re-enters the viewport (IntersectionObserver)
 * 2. The browser tab becomes visible again (Page Visibility API)
 * 3. The tab is visible and the data hasn't been refetched in over `staleMs` (default 5 min)
 *
 * Skips the very first trigger on mount so the initial load isn't doubled.
 */
const useRefetchOnVisible = (refetch: () => void, staleMs: number = STALE_MS): React.RefObject<HTMLDivElement | null> => {
  const ref = useRef<HTMLDivElement | null>(null);
  const mountedAt = useRef<number | null>(null);
  if (mountedAt.current === null) mountedAt.current = Date.now();
  const lastFetchedAt = useRef<number>(mountedAt.current);
  const refetchRef = useRef(refetch);
  const staleMsRef = useRef(staleMs);

  // Keep the refs pointing at the latest values without re-subscribing the effects below.
  useEffect(() => {
    refetchRef.current = refetch;
    staleMsRef.current = staleMs;
  });

  const stableRefetch = useCallback(() => {
    lastFetchedAt.current = Date.now();
    refetchRef.current();
  }, []);

  // Intersection Observer — fires when element scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (Date.now() - (mountedAt.current ?? 0) < 1000) return;
        stableRefetch();
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [stableRefetch]);

  // Page Visibility API — fires when user switches back to this tab, and drives
  // the stale-data timer below (no fetching/polling happens while hidden).
  useEffect(() => {
    if (document.visibilityState === 'visible' && Date.now() - (mountedAt.current ?? 0) > 1000) {
      stableRefetch();
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const stopStaleTimer = () => {
      if (intervalId !== null) clearInterval(intervalId);
      intervalId = null;
    };

    const startStaleTimer = () => {
      stopStaleTimer();
      intervalId = setInterval(() => {
        if (Date.now() - lastFetchedAt.current < staleMsRef.current) return;
        stableRefetch();
      }, STALE_CHECK_INTERVAL_MS);
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        stopStaleTimer();
        return;
      }
      // Page just became visible — refresh immediately, then resume the stale-data timer.
      if (Date.now() - (mountedAt.current ?? 0) > 1000) stableRefetch();
      startStaleTimer();
    };

    if (document.visibilityState === 'visible') startStaleTimer();

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopStaleTimer();
    };
  }, [stableRefetch]);

  return ref;
};

export default useRefetchOnVisible;
