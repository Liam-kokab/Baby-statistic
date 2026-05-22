import { useEffect, useRef, useCallback } from 'react';

/**
 * Calls `refetch` whenever:
 * 1. The observed element re-enters the viewport (IntersectionObserver)
 * 2. The browser tab becomes visible again (Page Visibility API)
 *
 * Skips the very first trigger on mount so the initial load isn't doubled.
 */
const useRefetchOnVisible = (refetch: () => void): React.RefObject<HTMLDivElement | null> => {
  const ref = useRef<HTMLDivElement | null>(null);
  const mountedAt = useRef(Date.now());
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  const stableRefetch = useCallback(() => {
    refetchRef.current();
  }, []);

  // Intersection Observer — fires when element scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        if (Date.now() - mountedAt.current < 1000) return;
        stableRefetch();
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [stableRefetch]);

  // Page Visibility API — fires when user switches back to this tab
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - mountedAt.current > 1000) {
        stableRefetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [stableRefetch]);

  return ref;
};

export default useRefetchOnVisible;
