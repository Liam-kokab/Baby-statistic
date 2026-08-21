import { useState, useEffect, useRef, Fragment, type ReactNode } from 'react';
import { authFetch } from '../../utils/authFetch';
import type { TSleep, TPumping, TMedicineWithLatestLog, THomeSummary } from 'baby-statistic-common';
import Button from '../../components/Button/Button';
import Input from '../../components/Input/Input';
import BlackScreenOverlay from '../../components/BlackScreenOverlay/BlackScreenOverlay';
import DataFreshnessDot from '../../components/DataFreshnessDot/DataFreshnessDot';
import BackupStatusDot from '../../components/BackupStatusDot/BackupStatusDot';
import { useActionFeedback } from '../../utils/useActionFeedback';
import type { TActionStatus } from '../../utils/useActionFeedback';
import useRefetchOnVisible from '../../utils/useRefetchOnVisible';
import useBlackScreen from '../../utils/useBlackScreen';
import useResource from '../../utils/useResource';
import { useWsConnected } from '../../contexts/WsProvider';
import { ACTION_MIN_MS, ACTION_DONE_MS, BLACK_SCREEN_KEEP_AWAKE_MS } from '../../config';
import { useTranslation } from '../../i18n/i18n';
import { DEFAULT_HOME_WIDGETS } from '../../utils/homeWidgets';
import type { THomeWidgetKey } from '../../utils/homeWidgets';
import { getSavedHomeWidgetOrder, getHiddenHomeWidgets, applyHomeWidgetOrder } from '../../utils/homeWidgetPrefs';
import { isMedicineTakenToday } from '../../utils/medicineStatus';
import type { TNoiseType } from '../../utils/whiteNoise';
import { whiteNoisePlayer } from '../../utils/whiteNoise';
import { useWhiteNoisePlayerState } from '../../utils/useWhiteNoisePlayerState';
import { WHITE_NOISE_DURATION_OPTIONS, formatWhiteNoiseRemaining } from '../../utils/whiteNoiseDurations';
import { getSelectedWhiteNoiseTypes, WHITE_NOISE_SOUNDS } from '../../utils/homeWhiteNoiseWidgetPrefs';
import type { TResource } from '../../utils/resourceKeys';
import styles from './HomePage.module.css';

const JSON_HEADERS: HeadersInit = { 'Content-Type': 'application/json' };

const RESOURCES: TResource[] = ['sleep', 'drankMilk', 'pumping', 'nappy', 'medicine'];
const SUMMARY_KEY = '/api/home/summary';
const fetchSummary = () => authFetch<THomeSummary>(SUMMARY_KEY);

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

const elapsedSeconds = (isoString: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));

const HomePage = () => {
  const { t } = useTranslation();
  const isBlackScreenOpenRef = useRef<boolean>(false);

  const formatAgo = (isoString: string): string => {
    const totalMin = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? t('HOME_AGO_HOURS_MINUTES', { h, m }) : t('HOME_AGO_MINUTES', { m });
  };

  // ── Sleep ─────────────────────────────────────────────────────────────────
  const [timerDisplay, setTimerDisplay] = useState('00:00:00');
  const sleep = useActionFeedback();

  // ── Drank milk ────────────────────────────────────────────────────────────
  const [drankAmount, setDrankAmount] = useState('');
  const bottle = useActionFeedback();
  const boob   = useActionFeedback();

  // ── Waste milk ────────────────────────────────────────────────────────────
  const [wasteAmount, setWasteAmount] = useState('');
  const waste = useActionFeedback();

  // ── Poop / Pee ────────────────────────────────────────────────────────────
  const poop = useActionFeedback();
  const pee  = useActionFeedback();

  // ── Pumping ───────────────────────────────────────────────────────────────
  const [pumpingDisplay, setPumpingDisplay] = useState('00:00:00');
  const pump = useActionFeedback();

  // ── Medicines ─────────────────────────────────────────────────────────────
  const [medStatuses, setMedStatuses] = useState<Record<number, TActionStatus>>({});

  // ── White noise widget — which sounds appear here is configured on Settings → Home; the
  // widget itself plays/stops the selected sounds, each with all three duration options. ──
  const [whiteNoiseSelectedTypes] = useState<TNoiseType[]>(() => getSelectedWhiteNoiseTypes());
  const { playingType: whiteNoisePlayingType, endAt: whiteNoiseEndAt, activeDuration: whiteNoiseActiveDuration } = useWhiteNoisePlayerState();

  // ── Everything the Home page needs, in one call — cached globally (see `useResource`) and
  // shared across every mount, so revisiting Home shows the last-known data instantly and only
  // refetches when sleep/drank-milk/pumping/nappy/medicine data actually changed (a WebSocket
  // "update", or the connection dropping for even a moment) rather than on every page visit. ──
  const { data: summary, isError, lastUpdatedAt, refresh } = useResource(SUMMARY_KEY, fetchSummary, RESOURCES);

  const activeSleep = summary?.latestSleep?.end === null ? summary.latestSleep : null;
  const timerRef = summary?.latestSleep?.end === null ? summary.latestSleep.start : (summary?.latestSleep?.end ?? null);
  const latestDrank = summary?.latestDrank ?? null;
  const suggestedAmount = summary?.suggestedAmount ?? null;
  const lastPumping = summary?.latestPumping ?? null;
  const pumpingTimerRef = summary?.latestPumping?.createdAt ?? null;
  const latestNappy = summary?.latestNappy?.createdAt ?? null;
  const medicines: TMedicineWithLatestLog[] = summary?.medicines ?? [];

  const refetchAll = (): void => {
    void refresh();
  };

  // ── Black screen mode ("always on display") — shared with every other page via
  // useBlackScreen/BlackScreenOverlay; refetches Home's own data on exit. ────────────────
  const { isOpen: isBlackScreenOpen, isExitVisible: isBlackScreenExitVisible, isCursorVisible: isBlackScreenCursorVisible, open: openBlackScreen, close: closeBlackScreen, onPointerActivity: onBlackScreenPointerActivity } = useBlackScreen({
    keepAwakeMs: BLACK_SCREEN_KEEP_AWAKE_MS,
    onClose: refetchAll,
  });

  useEffect(() => {
    isBlackScreenOpenRef.current = isBlackScreenOpen;
  }, [isBlackScreenOpen]);

  // `connected` now comes from the single app-wide `WsProvider` (see contexts/WsProvider.tsx) —
  // Home no longer owns its own socket, so opening the black screen never tears one down/reopens
  // it. The cached `summary` resource above already reacts to WebSocket updates on its own; the
  // stale-timer/tab-visibility fallback below is only needed while the WebSocket is disconnected.
  const wsConnected = useWsConnected();
  const visibilityRef = useRefetchOnVisible(refetchAll, undefined, !isBlackScreenOpen && !wsConnected);

  useEffect(() => {
    const medRefresh = setInterval(() => {
      if (!isBlackScreenOpenRef.current) refetchAll();
    }, 60_000);
    return () => { clearInterval(medRefresh); };
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
      if (res.ok) await refresh();
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
        await refresh();
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
      await refresh();
      return res.ok;
    });
  };

  const handlePoop = (): void => {
    poop.run(async () => {
      const res = await authFetch('/api/poop', { method: 'POST' });
      if (res.ok) await refresh();
      return res.ok;
    });
  };

  const handlePee = (): void => {
    pee.run(async () => {
      const res = await authFetch('/api/pee', { method: 'POST' });
      if (res.ok) await refresh();
      return res.ok;
    });
  };

  const handlePump = (): void => {
    pump.run(async () => {
      const res = await authFetch<TPumping>('/api/pumping', { method: 'POST' });
      if (res.ok) await refresh();
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
      if (res.ok) await refresh();
      setStatus(res.ok ? 'success' : 'error');
      setTimeout(() => setStatus('idle'), ACTION_DONE_MS);
    });
  };

  const isTakenToday = (m: TMedicineWithLatestLog): boolean => isMedicineTakenToday(m);

  const isSleeping = activeSleep !== null;


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
        <DataFreshnessDot lastUpdatedAt={lastUpdatedAt} isError={isError} wsConnected={wsConnected} />
        <BackupStatusDot />
        <button
          type="button"
          className={styles.heroEmojiButton}
          onClick={openBlackScreen}
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

      <BlackScreenOverlay
        isOpen={isBlackScreenOpen}
        isExitVisible={isBlackScreenExitVisible}
        isCursorVisible={isBlackScreenCursorVisible}
        onPointerActivity={onBlackScreenPointerActivity}
        onClose={closeBlackScreen}
      />
    </div>
  );
};

export default HomePage;
