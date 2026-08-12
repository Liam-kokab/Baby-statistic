import { useCallback, useEffect, useRef, useState } from 'react';

type TUseBlackScreenOptions = {
  /**
   * How long (ms) to hold the wake lock once opened, after which the display is allowed to
   * turn off normally while the overlay itself stays open. Omit entirely to skip the wake
   * lock/fullscreen "keep awake" behavior (e.g. on pages that only need the dimmed overlay).
   */
  keepAwakeMs?: number;
  /** Called right after the overlay closes — e.g. to trigger a data refetch. */
  onClose?: () => void;
};

type TUseBlackScreenResult = {
  isOpen: boolean;
  isExitVisible: boolean;
  isCursorVisible: boolean;
  open: () => void;
  close: () => void;
  /** Call on click/mousemove/touch inside the overlay to reveal the exit button briefly. */
  onPointerActivity: () => void;
};

/**
 * Shared black-screen ("always on display") open/close behavior: fullscreen, optional wake
 * lock keep-awake, and the auto-hiding exit button/cursor. Used by both HomePage and
 * PageLayout so every page's black screen behaves the same way.
 */
const useBlackScreen = ({ keepAwakeMs, onClose }: TUseBlackScreenOptions = {}): TUseBlackScreenResult => {
  const exitTimeoutRef = useRef<number | null>(null);
  const cursorTimeoutRef = useRef<number | null>(null);
  const keepAwakeTimeoutRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const wakeLockAllowedRef = useRef<boolean>(true);
  const onCloseRef = useRef(onClose);

  const [isOpen, setIsOpen] = useState(false);
  const [isExitVisible, setIsExitVisible] = useState(false);
  const [isCursorVisible, setIsCursorVisible] = useState(true);

  // Keep the ref pointing at the latest callback without re-subscribing anything below.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const clearExitTimeout = (): void => {
    if (exitTimeoutRef.current !== null) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  };

  const clearCursorTimeout = (): void => {
    if (cursorTimeoutRef.current !== null) {
      clearTimeout(cursorTimeoutRef.current);
      cursorTimeoutRef.current = null;
    }
  };

  const clearKeepAwakeTimeout = (): void => {
    if (keepAwakeTimeoutRef.current !== null) {
      clearTimeout(keepAwakeTimeoutRef.current);
      keepAwakeTimeoutRef.current = null;
    }
  };

  const releaseWakeLock = (): void => {
    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    if (sentinel !== null) {
      void sentinel.release().catch(() => {
        // Ignore release failures.
      });
    }
  };

  const requestWakeLock = async (): Promise<void> => {
    if (keepAwakeMs === undefined) return;
    if (!wakeLockAllowedRef.current) return;
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Wake lock may be denied (e.g. low battery, unsupported browser); the overlay still works.
    }
  };

  const enterFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement !== null) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // If fullscreen is blocked by the browser, still show the overlay.
    }
  };

  const exitFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement === null) return;
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore exit failures; the overlay state is still cleared.
    }
  };

  const onPointerActivity = useCallback((): void => {
    setIsExitVisible(true);
    setIsCursorVisible(true);
    clearExitTimeout();
    exitTimeoutRef.current = window.setTimeout(() => {
      setIsExitVisible(false);
      exitTimeoutRef.current = null;
    }, 1000);

    clearCursorTimeout();
    cursorTimeoutRef.current = window.setTimeout(() => {
      setIsCursorVisible(false);
      cursorTimeoutRef.current = null;
    }, 2000);
  }, []);

  const open = useCallback((): void => {
    clearExitTimeout();
    clearCursorTimeout();
    clearKeepAwakeTimeout();
    wakeLockAllowedRef.current = true;
    setIsExitVisible(false);
    setIsCursorVisible(true);
    setIsOpen(true);
    void enterFullscreen();
    void requestWakeLock();
    if (keepAwakeMs !== undefined) {
      keepAwakeTimeoutRef.current = window.setTimeout(() => {
        keepAwakeTimeoutRef.current = null;
        wakeLockAllowedRef.current = false;
        releaseWakeLock();
      }, keepAwakeMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepAwakeMs]);

  const close = useCallback((): void => {
    clearExitTimeout();
    clearCursorTimeout();
    clearKeepAwakeTimeout();
    releaseWakeLock();
    setIsExitVisible(false);
    setIsCursorVisible(true);
    setIsOpen(false);
    void exitFullscreen();
    onCloseRef.current?.();
  }, []);

  // Wake locks are released automatically when the tab becomes hidden; re-request it once
  // the black screen is visible again so the display keeps staying on.
  useEffect(() => {
    if (!isOpen || keepAwakeMs === undefined) return;
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, keepAwakeMs]);

  // Release the wake lock and any pending timeouts if the component unmounts while open.
  useEffect(() => () => {
    clearExitTimeout();
    clearCursorTimeout();
    clearKeepAwakeTimeout();
    releaseWakeLock();
  }, []);

  return { isOpen, isExitVisible, isCursorVisible, open, close, onPointerActivity };
};

export default useBlackScreen;

