import { useState, useEffect, useRef, Fragment, type MouseEvent, type ReactNode } from 'react';
import { authFetch } from '../../utils/authFetch';
import type { TSleep, TMedicineWithLatestLog, TDrankMilk, TPumping } from 'baby-statistic-common';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import { useActionFeedback } from '../../utils/useActionFeedback';
import type { TActionStatus } from '../../utils/useActionFeedback';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import { ACTION_MIN_MS, ACTION_DONE_MS, BLACK_SCREEN_KEEP_AWAKE_MS } from '../../config';
import { useTranslation } from '../../i18n/i18n';
import { DEFAULT_HOME_WIDGETS } from '../../utils/homeWidgets';
import type { THomeWidgetKey } from '../../utils/homeWidgets';
import { getSavedHomeWidgetOrder, getHiddenHomeWidgets, applyHomeWidgetOrder } from '../../utils/homeWidgetPrefs';
import type { TNoiseType } from '../../utils/whiteNoise';
import { whiteNoisePlayer } from '../../utils/whiteNoise';
import { useWhiteNoisePlayerState } from '../../utils/useWhiteNoisePlayerState';
import { WHITE_NOISE_DURATION_OPTIONS, formatWhiteNoiseRemaining } from '../../utils/whiteNoiseDurations';
import { getSelectedWhiteNoiseTypes, WHITE_NOISE_SOUNDS } from '../../utils/homeWhiteNoiseWidgetPrefs';
import { getHiddenBlackScreenFields, getBlackScreenOpacityPercent } from '../../utils/blackScreenPrefs';
import type { TBlackScreenField } from '../../utils/blackScreenPrefs';
import { formatTime as formatClockTime } from '../../utils/format';
import styles from './HomePage.module.css';

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

const getMilkAgeClass = (createdAt: string): string => {
  const ageMin = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  if (ageMin < 90) return 'milkLastGreen';
  if (ageMin < 120) return 'milkLastYellow';
  return 'milkLastDefault';
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Hours:minutes only (no seconds) — used on the black screen readout so the text changes
 * at most once a minute instead of every second. */
const formatTimeHM = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const elapsedSeconds = (isoString: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));

const HomePage = () => {
  const { t } = useTranslation();
  const blackScreenExitTimeoutRef = useRef<number | null>(null);
  const blackScreenCursorTimeoutRef = useRef<number | null>(null);
  const blackScreenKeepAwakeTimeoutRef = useRef<number | null>(null);
  const blackScreenWakeLockRef = useRef<WakeLockSentinel | null>(null);
  const blackScreenWakeLockAllowedRef = useRef<boolean>(true);

  const formatAgo = (isoString: string): string => {
    const totalMin = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? t('HOME_AGO_HOURS_MINUTES', { h, m }) : t('HOME_AGO_MINUTES', { m });
  };

  // ── Sleep ─────────────────────────────────────────────────────────────────
  const [activeSleep, setActiveSleep]   = useState<TSleep | null>(null);
  const [timerRef,    setTimerRef]      = useState<string | null>(null);
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const sleep = useActionFeedback();

  // ── Drank milk ────────────────────────────────────────────────────────────
  const [drankAmount, setDrankAmount] = useState('');
  const [latestDrank, setLatestDrank] = useState<TDrankMilk | null>(null);
  const [suggestedAmount, setSuggestedAmount] = useState<number | null>(null);
  const bottle = useActionFeedback();
  const boob   = useActionFeedback();

  const loadLatestDrank = async (): Promise<void> => {
    const res = await authFetch<TDrankMilk | null>('/api/drank-milk/latest');
    if (res.ok) {
      setLatestDrank(res.data);
      if (res.data) {
        const ageMin = Math.floor((Date.now() - new Date(res.data.createdAt).getTime()) / 60_000);
        console.log(`[drankMilk] last entry: ${res.data.createdAt} | age: ${ageMin}m (${(ageMin / 60).toFixed(2)}h)`);
      } else {
        console.log('[drankMilk] no entries found');
      }
    }
  };

  const loadSuggested = async (): Promise<void> => {
    const res = await authFetch<{ nextDrinkAmount: number }>('/api/drank-milk/suggested');
    if (res.ok) setSuggestedAmount(res.data.nextDrinkAmount ?? null);
  };

  // ── Waste milk ────────────────────────────────────────────────────────────
  const [wasteAmount, setWasteAmount] = useState('');
  const waste = useActionFeedback();

  // ── Poop / Pee ────────────────────────────────────────────────────────────
  const poop = useActionFeedback();
  const pee  = useActionFeedback();
  const [latestNappy, setLatestNappy] = useState<string | null>(null);

  const loadLatestNappy = async (): Promise<void> => {
    const res = await authFetch<{ createdAt: string } | null>('/api/nappy/latest');
    if (res.ok) setLatestNappy(res.data?.createdAt ?? null);
  };

  // ── Pumping ───────────────────────────────────────────────────────────────
  const [lastPumping, setLastPumping] = useState<TPumping | null>(null);
  const [pumpingTimerRef, setPumpingTimerRef] = useState<string | null>(null);
  const [pumpingDisplay, setPumpingDisplay] = useState('00:00:00');
  const pump = useActionFeedback();

  const loadLatestPumping = async (): Promise<void> => {
    const res = await authFetch<TPumping | null>('/api/pumping/latest');
    if (res.ok) {
      setLastPumping(res.data);
      setPumpingTimerRef(res.data?.createdAt ?? null);
    }
  };

  // ── Medicines ─────────────────────────────────────────────────────────────
  const [medicines, setMedicines]   = useState<TMedicineWithLatestLog[]>([]);
  const [medStatuses, setMedStatuses] = useState<Record<number, TActionStatus>>({});

  // ── White noise widget — which sounds appear here is configured on Settings → Home; the
  // widget itself plays/stops the selected sounds, each with all three duration options. ──
  const [whiteNoiseSelectedTypes] = useState<TNoiseType[]>(() => getSelectedWhiteNoiseTypes());
  const { playingType: whiteNoisePlayingType, endAt: whiteNoiseEndAt, activeDuration: whiteNoiseActiveDuration } = useWhiteNoisePlayerState();

  // ── Black screen mode ──────────────────────────────────────────────────────
  const [isBlackScreenOpen, setIsBlackScreenOpen] = useState<boolean>(false);
  const [isBlackScreenExitVisible, setIsBlackScreenExitVisible] = useState<boolean>(false);
  const [isBlackScreenCursorVisible, setIsBlackScreenCursorVisible] = useState<boolean>(true);
  const [blackScreenHiddenFields] = useState<TBlackScreenField[]>(() => getHiddenBlackScreenFields());
  const [blackScreenOpacity] = useState<number>(() => getBlackScreenOpacityPercent() / 100);
  const [blackScreenNow, setBlackScreenNow] = useState<Date>(() => new Date());
  const isBlackScreenFieldShown = (field: TBlackScreenField): boolean => !blackScreenHiddenFields.includes(field);

  // Tick once a minute while the black screen is open — the readout only ever shows
  // hours:minutes, never seconds, so nothing on it should change more often than that.
  useEffect(() => {
    if (!isBlackScreenOpen) return;
    setBlackScreenNow(new Date());
    const id = setInterval(() => setBlackScreenNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isBlackScreenOpen]);

  // Wake locks are released automatically when the tab becomes hidden; re-request it
  // once the black screen is visible again so the display keeps staying on.
  useEffect(() => {
    if (!isBlackScreenOpen) return;
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void requestBlackScreenWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isBlackScreenOpen]);

  // Release the wake lock and any pending timeouts if the component unmounts while open.
  useEffect(() => () => {
    clearBlackScreenExitTimeout();
    clearBlackScreenCursorTimeout();
    clearBlackScreenKeepAwakeTimeout();
    releaseBlackScreenWakeLock();
  }, []);

  const loadMedicines = async (): Promise<void> => {
    const res = await authFetch<TMedicineWithLatestLog[]>('/api/medicine');
    if (res.ok) setMedicines(res.data);
  };

  // Load latest sleep on mount
  const loadSleep = async (): Promise<void> => {
    const res = await authFetch<TSleep | null>('/api/sleep/latest');
    if (!res.ok) return;
    const latest = res.data;
    if (latest?.end === null) {
      setActiveSleep(latest);
      setTimerRef(latest.start);
    } else {
      setActiveSleep(null);
      setTimerRef(latest?.end ?? null);
    }
  };

  const refetchAll = (): void => {
    loadSleep();
    loadLatestDrank();
    loadSuggested();
    loadLatestPumping();
    loadLatestNappy();
    loadMedicines();
  };

  const visibilityRef = useRefetchOnVisible(refetchAll);

  useEffect(() => {
    refetchAll();
    const medRefresh = setInterval(loadMedicines, 60_000);
    return () => { clearInterval(medRefresh); };
  }, []);

  useEffect(() => {
    return () => {
      if (blackScreenExitTimeoutRef.current !== null) {
        clearTimeout(blackScreenExitTimeoutRef.current);
        blackScreenExitTimeoutRef.current = null;
      }
      if (blackScreenCursorTimeoutRef.current !== null) {
        clearTimeout(blackScreenCursorTimeoutRef.current);
        blackScreenCursorTimeoutRef.current = null;
      }
    };
  }, []);

  // Timer tick — reruns whenever the reference timestamp changes
  useEffect(() => {
    setTimerDisplay(timerRef ? formatTime(elapsedSeconds(timerRef)) : '00:00:00');
    const id = setInterval(() => {
      setTimerDisplay(timerRef ? formatTime(elapsedSeconds(timerRef)) : '00:00:00');
    }, 1000);
    return () => clearInterval(id);
  }, [timerRef]);

  // Pumping timer tick
  useEffect(() => {
    setPumpingDisplay(pumpingTimerRef ? formatTime(elapsedSeconds(pumpingTimerRef)) : '00:00:00');
    const id = setInterval(() => {
      setPumpingDisplay(pumpingTimerRef ? formatTime(elapsedSeconds(pumpingTimerRef)) : '00:00:00');
    }, 1000);
    return () => clearInterval(id);
  }, [pumpingTimerRef]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSleepToggle = (): void => {
    sleep.run(async () => {
      const now = new Date().toISOString();
      const res = activeSleep
        ? await authFetch<TSleep>(`/api/sleep/${activeSleep.id}`, {
            method: 'PUT',
            headers: JSON_HEADERS,
            body: JSON.stringify({ start: activeSleep.start, end: now }),
          })
        : await authFetch<TSleep>('/api/sleep', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ start: now }),
          });
      if (res.ok) await loadSleep();
      return res.ok;
    });
  };

  const handleDrankMilk = (source: 'FRIDGE' | 'BOOB', isNewBottle: boolean): void => {
    const amount = Number(drankAmount);
    if (!amount || amount <= 0) return;
    const fb = source === 'FRIDGE' ? bottle : boob;
    fb.run(async () => {
      const res = await authFetch('/api/drank-milk', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ amount, source, isNewBottle }),
      });
      if (res.ok) {
        setDrankAmount('');
        await Promise.all([
          loadLatestDrank(),
          loadSuggested(),
        ]);
      }
      return res.ok;
    });
  };

  const latestDrankAgeMinutes = latestDrank
    ? Math.floor((Date.now() - new Date(latestDrank.createdAt).getTime()) / 60_000)
    : null;
  const prevBottleEnabled = latestDrankAgeMinutes !== null && latestDrankAgeMinutes <= 150;

  const handleWasteMilk = (): void => {
    const amount = Number(wasteAmount);
    if (!amount || amount <= 0) return;
    waste.run(async () => {
      const res = await authFetch('/api/drank-milk/waste', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ amount }),
      });
      if (res.ok) setWasteAmount('');
      await Promise.all([
        loadLatestDrank(),
        loadSuggested(),
      ]);
      return res.ok;
    });
  };

  const handlePoop = (): void => {
    poop.run(async () => {
      const res = await authFetch('/api/poop', { method: 'POST' });
      if (res.ok) await loadLatestNappy();
      return res.ok;
    });
  };

  const handlePee = (): void => {
    pee.run(async () => {
      const res = await authFetch('/api/pee', { method: 'POST' });
      if (res.ok) await loadLatestNappy();
      return res.ok;
    });
  };

  const handlePump = (): void => {
    pump.run(async () => {
      const res = await authFetch<TPumping>('/api/pumping', { method: 'POST' });
      if (res.ok) await loadLatestPumping();
      return res.ok;
    });
  };

  const handleMarkTaken = (id: number): void => {
    if (medStatuses[id] && medStatuses[id] !== 'idle') return;
    const setStatus = (s: TActionStatus) =>
      setMedStatuses((prev) => ({ ...prev, [id]: s }));
    setStatus('loading');
    const t0 = Date.now();
    authFetch(`/api/medicine/${id}/log`, { method: 'POST' }).then(async (res) => {
      const wait = ACTION_MIN_MS - (Date.now() - t0);
      if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
      if (res.ok) await loadMedicines();
      setStatus(res.ok ? 'success' : 'error');
      setTimeout(() => setStatus('idle'), ACTION_DONE_MS);
    });
  };

  const isTakenToday = (m: TMedicineWithLatestLog): boolean => {
    if (!m.latestTakenAt) return false;
    const today = new Date().toLocaleDateString('sv'); // YYYY-MM-DD in local time
    return m.latestTakenAt.slice(0, 10) === today;
  };

  const isSleeping = activeSleep !== null;

  const clearBlackScreenExitTimeout = (): void => {
    if (blackScreenExitTimeoutRef.current !== null) {
      clearTimeout(blackScreenExitTimeoutRef.current);
      blackScreenExitTimeoutRef.current = null;
    }
  };

  const clearBlackScreenCursorTimeout = (): void => {
    if (blackScreenCursorTimeoutRef.current !== null) {
      clearTimeout(blackScreenCursorTimeoutRef.current);
      blackScreenCursorTimeoutRef.current = null;
    }
  };

  const clearBlackScreenKeepAwakeTimeout = (): void => {
    if (blackScreenKeepAwakeTimeoutRef.current !== null) {
      clearTimeout(blackScreenKeepAwakeTimeoutRef.current);
      blackScreenKeepAwakeTimeoutRef.current = null;
    }
  };

  const releaseBlackScreenWakeLock = (): void => {
    const sentinel = blackScreenWakeLockRef.current;
    blackScreenWakeLockRef.current = null;
    if (sentinel !== null) {
      void sentinel.release().catch(() => {
        // Ignore release failures.
      });
    }
  };

  const requestBlackScreenWakeLock = async (): Promise<void> => {
    if (!blackScreenWakeLockAllowedRef.current) return;
    if (!('wakeLock' in navigator)) return;
    try {
      blackScreenWakeLockRef.current = await navigator.wakeLock.request('screen');
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

  const showBlackScreenExit = (): void => {
    setIsBlackScreenExitVisible(true);
    setIsBlackScreenCursorVisible(true);
    clearBlackScreenExitTimeout();
    blackScreenExitTimeoutRef.current = window.setTimeout(() => {
      setIsBlackScreenExitVisible(false);
      blackScreenExitTimeoutRef.current = null;
    }, 1000);

    clearBlackScreenCursorTimeout();
    blackScreenCursorTimeoutRef.current = window.setTimeout(() => {
      setIsBlackScreenCursorVisible(false);
      blackScreenCursorTimeoutRef.current = null;
    }, 2000);
  };

  const handleOpenBlackScreen = (): void => {
    clearBlackScreenExitTimeout();
    clearBlackScreenCursorTimeout();
    clearBlackScreenKeepAwakeTimeout();
    blackScreenWakeLockAllowedRef.current = true;
    setIsBlackScreenExitVisible(false);
    setIsBlackScreenCursorVisible(true);
    setIsBlackScreenOpen(true);
    void enterFullscreen();
    void requestBlackScreenWakeLock();
    blackScreenKeepAwakeTimeoutRef.current = window.setTimeout(() => {
      blackScreenKeepAwakeTimeoutRef.current = null;
      allowBlackScreenToTurnOff();
    }, BLACK_SCREEN_KEEP_AWAKE_MS);
  };

  // After the configured duration, stop keeping the display awake and let it turn off
  // normally — the overlay itself (and fullscreen) stays open until the user exits it.
  const allowBlackScreenToTurnOff = (): void => {
    blackScreenWakeLockAllowedRef.current = false;
    releaseBlackScreenWakeLock();
  };

  const closeBlackScreen = (): void => {
    clearBlackScreenExitTimeout();
    clearBlackScreenCursorTimeout();
    clearBlackScreenKeepAwakeTimeout();
    releaseBlackScreenWakeLock();
    setIsBlackScreenExitVisible(false);
    setIsBlackScreenCursorVisible(true);
    setIsBlackScreenOpen(false);
    void exitFullscreen();
  };

  const handleCloseBlackScreen = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    closeBlackScreen();
  };

  // ── Widgets — order & visibility are user-configurable (Settings → Home tab); all
  // widgets are shown, in the order below, by default. ──────────────────────────
  const renderSleepWidget = (): ReactNode => (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>{t('HOME_SLEEP_TITLE')}</h2>
      <div className={styles.sleepRow}>
        <div className={styles.sleepLeft}>
          <span className={`${styles.sleepBadge} ${isSleeping ? styles.sleeping : styles.awake}`}>
            {isSleeping ? t('HOME_SLEEP_SLEEPING') : t('HOME_SLEEP_AWAKE')}
          </span>
          <span className={styles.timer}>{timerDisplay}</span>
          <span className={styles.timerLabel}>
            {isSleeping ? t('HOME_SLEEP_SLEEPING_FOR') : t('HOME_SLEEP_AWAKE_FOR')}
          </span>
        </div>
        <Button
          text={isSleeping ? t('HOME_SLEEP_END') : t('HOME_SLEEP_START')}
          emoji={isSleeping ? '☀️' : '🌙'}
          onClick={handleSleepToggle}
          status={sleep.status}
          variant={isSleeping ? 'ghost' : 'primary'}
        />
      </div>

      <div className={styles.divider} />

      <div className={styles.sleepRow}>
        <div className={styles.sleepLeft}>
          <span className={styles.timer}>{pumpingDisplay}</span>
          <span className={styles.timerLabel}>
            {lastPumping ? t('HOME_SLEEP_SINCE_LAST_PUMP') : t('HOME_SLEEP_NO_PUMP_LOGGED')}
          </span>
        </div>
        <Button
          text={t('HOME_SLEEP_PUMPED')}
          emoji="🥛"
          onClick={handlePump}
          status={pump.status}
          variant="primary"
        />
      </div>
    </section>
  );

  const renderMilkWidget = (): ReactNode => (
    <section className={styles.card}>
      <div className={styles.milkHeader}>
        <h2 className={styles.sectionTitle}>{t('HOME_MILK_TITLE')}</h2>
        {latestDrank ? (
          <span className={`${styles.milkLastInfo} ${styles[getMilkAgeClass(latestDrank.createdAt)]}`}>
            {latestDrank.amount} ml · {formatAgo(latestDrank.createdAt)}
          </span>
        ) : (
          <span className={`${styles.milkLastInfo} ${styles.milkLastDefault}`}>
            {t('HOME_MILK_NO_LAST_DRANK')}
          </span>
        )}
      </div>

      <div className={styles.subSection}>
        <p className={styles.subLabel}>{t('HOME_MILK_BABY_DRANK')}</p>
        <Input
          label={t('HOME_MILK_AMOUNT_ML')}
          value={drankAmount}
          onChange={setDrankAmount}
          type="tel"
          placeholder={`e.g. ${suggestedAmount ?? 80}`}
          name="drankAmount"
        />
        <div className={styles.btnRowFull}>
            <Button
              text={t('HOME_MILK_PREV_BOTTLE')}
              emoji="🍼"
              onClick={() => handleDrankMilk('FRIDGE', false)}
              status={bottle.status}
              disabled={!drankAmount || !prevBottleEnabled}
            />
            <Button
              text={t('HOME_MILK_NEW_BOTTLE')}
              emoji="🍼"
              onClick={() => handleDrankMilk('FRIDGE', true)}
              status={bottle.status}
              disabled={!drankAmount}
            />
          </div>
          <div className={styles.btnRowFull}>
            <Button
              text={t('HOME_MILK_BOOB')}
              emoji="🤱"
              onClick={() => handleDrankMilk('BOOB', true)}
              status={boob.status}
              disabled={!drankAmount}
              variant="secondary"
            />
          </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.subSection}>
        <p className={styles.subLabel}>{t('HOME_MILK_WASTE_LABEL')}</p>
        <Input
          label={t('HOME_MILK_AMOUNT_ML')}
          value={wasteAmount}
          onChange={setWasteAmount}
          type="tel"
          placeholder={t('HOME_MILK_WASTE_PLACEHOLDER')}
          name="wasteAmount"
        />
        <Button
          text={t('HOME_MILK_SUBTRACT_WASTE')}
          emoji="➖"
          onClick={handleWasteMilk}
          status={waste.status}
          disabled={!wasteAmount}
          variant="ghost"
        />
      </div>
    </section>
  );

  const renderNappyWidget = (): ReactNode => (
    <section className={styles.card}>
      <div className={styles.milkHeader}>
        <h2 className={styles.sectionTitle}>{t('HOME_NAPPY_TITLE')}</h2>
        <span className={`${styles.milkLastInfo} ${styles.milkLastDefault}`}>
          {latestNappy ? t('HOME_NAPPY_CHANGED', { time: formatAgo(latestNappy) }) : t('HOME_NAPPY_NONE_LOGGED')}
        </span>
      </div>
      <div className={styles.btnRowFull}>
        <Button
          text={t('HOME_NAPPY_POOP')}
          onClick={handlePoop}
          status={poop.status}
          variant="secondary"
        />
        <Button
          text={t('HOME_NAPPY_PEE')}
          onClick={handlePee}
          status={pee.status}
          variant="secondary"
        />
      </div>
    </section>
  );

  const renderMedicinesWidget = (): ReactNode =>
    medicines.length > 0 ? (
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>{t('HOME_MEDICINES_TITLE')}</h2>
        <div className={styles.medList}>
          {medicines.map((m) => {
            const takenToday = isTakenToday(m);
            return (
              <div key={m.id} className={styles.medRow}>
                <div className={styles.medInfo}>
                  <span className={styles.medName}>{m.name}</span>
                  <span className={`${styles.medLabel} ${takenToday ? styles.medLabelCountdown : styles.medLabelOverdue}`}>
                    {takenToday ? t('HOME_MEDICINES_TAKEN_TODAY') : t('HOME_MEDICINES_NOT_TAKEN_TODAY')}
                  </span>
                </div>
                <Button
                  text={t('HOME_MEDICINES_TAKE')}
                  emoji="💊"
                  onClick={() => handleMarkTaken(m.id)}
                  status={medStatuses[m.id] ?? 'idle'}
                  variant={takenToday ? 'ghost' : 'primary'}
                  disabled={takenToday}
                />
              </div>
            );
          })}
        </div>
      </section>
    ) : null;

  const renderWhiteNoiseWidget = (): ReactNode => (
    <section className={styles.card}>
      <h2 className={styles.sectionTitle}>{t('HOME_WHITE_NOISE_TITLE')}</h2>
      {whiteNoiseSelectedTypes.length === 0 ? (
        <p className={styles.emptyNote}>{t('HOME_WHITE_NOISE_NONE_SELECTED')}</p>
      ) : (
        WHITE_NOISE_SOUNDS
          .filter((s) => whiteNoiseSelectedTypes.includes(s.type))
          .map(({ type, emoji, titleKey }, index) => (
            <Fragment key={type}>
              {index > 0 ? <div className={styles.divider} /> : null}
              <div className={styles.subSection}>
                <p className={styles.subLabel}>{emoji} {t(titleKey)}</p>
                <div className={styles.btnRowFull}>
                  {WHITE_NOISE_DURATION_OPTIONS.map((option) => {
                    const isActive = whiteNoisePlayingType === type && whiteNoiseActiveDuration === option.minutes;
                    const text = isActive
                      ? (option.minutes !== null && whiteNoiseEndAt !== null ? formatWhiteNoiseRemaining(whiteNoiseEndAt) : t('WHITE_NOISE_PAGE_STOP'))
                      : t(option.labelKey);
                    return (
                      <Button
                        key={option.labelKey}
                        text={text}
                        emoji={isActive ? '⏹️' : option.emoji}
                        onClick={() => (isActive ? whiteNoisePlayer.stop() : whiteNoisePlayer.play(type, option.minutes))}
                        variant={isActive ? 'primary' : 'secondary'}
                      />
                    );
                  })}
                </div>
              </div>
            </Fragment>
          ))
      )}
    </section>
  );

  const widgetRenderers: Record<THomeWidgetKey, () => ReactNode> = {
    sleep: renderSleepWidget,
    milk: renderMilkWidget,
    nappy: renderNappyWidget,
    medicines: renderMedicinesWidget,
    whiteNoise: renderWhiteNoiseWidget,
  };


  const hiddenWidgets = new Set(getHiddenHomeWidgets());
  const orderedWidgets = applyHomeWidgetOrder(DEFAULT_HOME_WIDGETS, getSavedHomeWidgetOrder())
    .filter((w) => !hiddenWidgets.has(w.key));

  return (
    <div className={styles.page} ref={visibilityRef}>
      <div className={styles.hero}>
        <button
          type="button"
          className={styles.heroEmojiButton}
          onClick={handleOpenBlackScreen}
          aria-label={t('HOME_BLACK_SCREEN_OPEN')}
        >
          <span className={styles.heroEmoji}>{isSleeping ? '😴' : '🌸'}</span>
        </button>
        <h1 className={styles.heroTitle}>{t('HOME_TITLE')}</h1>
        <p className={styles.heroSub}>{t('HOME_SUBTITLE')}</p>
      </div>

      <div className={styles.content}>
        {orderedWidgets.map((w) => (
          <Fragment key={w.key}>{widgetRenderers[w.key]()}</Fragment>
        ))}
      </div>

      {isBlackScreenOpen ? (
        <div
          className={`${styles.blackScreenOverlay} ${isBlackScreenCursorVisible ? styles.blackScreenCursorVisible : styles.blackScreenCursorHidden}`}
          onClick={showBlackScreenExit}
          onMouseMove={showBlackScreenExit}
          onTouchStart={showBlackScreenExit}
          aria-label={t('HOME_BLACK_SCREEN_OVERLAY')}
        >
          {isBlackScreenFieldShown('time') ? (
            <div
              className={`${styles.blackScreenTimeWrap} ${isBlackScreenExitVisible ? styles.blackScreenDataHidden : styles.blackScreenDataVisible}`}
              aria-hidden="true"
            >
              <span className={styles.blackScreenReadoutText} style={{ opacity: blackScreenOpacity }}>
                {formatClockTime(blackScreenNow.toISOString())}
              </span>
            </div>
          ) : null}

          {isBlackScreenFieldShown('sleep') || isBlackScreenFieldShown('pump') || isBlackScreenFieldShown('bottle') ? (
            <div
              className={`${styles.blackScreenOtherWrap} ${isBlackScreenExitVisible ? styles.blackScreenDataHidden : styles.blackScreenDataVisible}`}
              aria-hidden="true"
            >
              {isBlackScreenFieldShown('sleep') ? (
                <span className={styles.blackScreenReadoutText} style={{ opacity: blackScreenOpacity }}>
                  {isSleeping ? t('HOME_BLACK_SCREEN_SLEEPING_FOR') : t('HOME_BLACK_SCREEN_AWAKE_FOR')} {formatTimeHM(timerRef ? elapsedSeconds(timerRef) : 0)}
                </span>
              ) : null}
              {isBlackScreenFieldShown('pump') ? (
                <span className={styles.blackScreenReadoutText} style={{ opacity: blackScreenOpacity }}>
                  {t('HOME_BLACK_SCREEN_SINCE_PUMP')} {formatTimeHM(pumpingTimerRef ? elapsedSeconds(pumpingTimerRef) : 0)}
                </span>
              ) : null}
              {isBlackScreenFieldShown('bottle') ? (
                <span className={styles.blackScreenReadoutText} style={{ opacity: blackScreenOpacity }}>
                  {latestDrank
                    ? `${t('HOME_BLACK_SCREEN_LAST_BOTTLE')} ${latestDrank.amount} ml · ${formatAgo(latestDrank.createdAt)}`
                    : t('HOME_BLACK_SCREEN_NO_BOTTLE')}
                </span>
              ) : null}
            </div>
          ) : null}
          <Button
            text={t('HOME_BLACK_SCREEN_EXIT')}
            onClick={handleCloseBlackScreen}
            aria-label={t('HOME_BLACK_SCREEN_EXIT')}
            variant="secondary"
            className={`${styles.blackScreenExitButton} ${isBlackScreenExitVisible ? styles.blackScreenExitButtonVisible : styles.blackScreenExitButtonHidden}`}
          />
        </div>
      ) : null}
    </div>
  );
};

export default HomePage;
