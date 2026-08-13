import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';
import Button from '../Button/Button';
import { useTranslation } from '../../i18n/i18n';
import useAlwaysOnDisplayData from '../../utils/useAlwaysOnDisplayData';
import { getHiddenBlackScreenFields, getBlackScreenOpacityPercent } from '../../utils/blackScreenPrefs';
import type { TBlackScreenField } from '../../utils/blackScreenPrefs';
import { formatTime as formatClockTime } from '../../utils/format';
import styles from './BlackScreenOverlay.module.css';

type TProps = {
  isOpen: boolean;
  isExitVisible: boolean;
  isCursorVisible: boolean;
  onPointerActivity: () => void;
  onClose: () => void;
};

const formatTimeHM = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const elapsedSeconds = (isoString: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));

/**
 * Fullscreen dimmed overlay ("always on display") shown on every page. Shows the current time
 * plus sleep/pump/last-bottle readouts fetched from GET /api/home/always-on-display, refreshed
 * when it opens, live via WebSocket whenever another device logs an update, and every 5 minutes
 * as a fallback (see `useAlwaysOnDisplayData`). Rendered by both HomePage and PageLayout via
 * the shared `useBlackScreen` hook, which controls `isOpen`/exit-button/cursor visibility.
 */
const BlackScreenOverlay = ({ isOpen, isExitVisible, isCursorVisible, onPointerActivity, onClose }: TProps) => {
  const { t } = useTranslation();
  const data = useAlwaysOnDisplayData(isOpen);
  const [hiddenFields] = useState<TBlackScreenField[]>(() => getHiddenBlackScreenFields());
  const [opacity] = useState<number>(() => getBlackScreenOpacityPercent() / 100);
  const [now, setNow] = useState<Date>(() => new Date());
  const isFieldShown = (field: TBlackScreenField): boolean => !hiddenFields.includes(field);

  // Tick once a minute while open — the readout only ever shows hours:minutes.
  useEffect(() => {
    if (!isOpen) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [isOpen]);

  if (!isOpen) return null;

  const isSleeping = data?.latestSleep?.end === null;
  const sleepRef = isSleeping ? data?.latestSleep?.start ?? null : data?.latestSleep?.end ?? null;
  const pumpRef = data?.latestPumping?.createdAt ?? null;
  const latestDrank = data?.latestDrank ?? null;

  const formatAgo = (isoString: string): string => {
    const totalMin = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? t('HOME_AGO_HOURS_MINUTES', { h, m }) : t('HOME_AGO_MINUTES', { m });
  };

  const handleClose = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      className={`${styles.blackScreenOverlay} ${isCursorVisible ? styles.blackScreenCursorVisible : styles.blackScreenCursorHidden}`}
      onClick={onPointerActivity}
      onMouseMove={onPointerActivity}
      onTouchStart={onPointerActivity}
      aria-label={t('HOME_BLACK_SCREEN_OVERLAY')}
    >
      {isFieldShown('time') ? (
        <div
          className={`${styles.blackScreenTimeWrap} ${isExitVisible ? styles.blackScreenDataHidden : styles.blackScreenDataVisible}`}
          aria-hidden="true"
        >
          <span className={styles.blackScreenReadoutText} style={{ opacity }}>
            {formatClockTime(now.toISOString())}
          </span>
        </div>
      ) : null}

      {isFieldShown('sleep') || isFieldShown('pump') || isFieldShown('bottle') ? (
        <div
          className={`${styles.blackScreenOtherWrap} ${isExitVisible ? styles.blackScreenDataHidden : styles.blackScreenDataVisible}`}
          aria-hidden="true"
        >
          {isFieldShown('sleep') ? (
            <span className={styles.blackScreenReadoutText} style={{ opacity }}>
              {isSleeping ? t('HOME_BLACK_SCREEN_SLEEPING_FOR') : t('HOME_BLACK_SCREEN_AWAKE_FOR')} {formatTimeHM(sleepRef ? elapsedSeconds(sleepRef) : 0)}
            </span>
          ) : null}
          {isFieldShown('pump') ? (
            <span className={styles.blackScreenReadoutText} style={{ opacity }}>
              {t('HOME_BLACK_SCREEN_SINCE_PUMP')} {formatTimeHM(pumpRef ? elapsedSeconds(pumpRef) : 0)}
            </span>
          ) : null}
          {isFieldShown('bottle') ? (
            <span className={styles.blackScreenReadoutText} style={{ opacity }}>
              {latestDrank
                ? `${t('HOME_BLACK_SCREEN_LAST_BOTTLE')} ${latestDrank.amount} ml · ${formatAgo(latestDrank.createdAt)}`
                : t('HOME_BLACK_SCREEN_NO_BOTTLE')}
            </span>
          ) : null}
        </div>
      ) : null}

      <Button
        text={t('HOME_BLACK_SCREEN_EXIT')}
        onClick={handleClose}
        aria-label={t('HOME_BLACK_SCREEN_EXIT')}
        variant="secondary"
        className={`${styles.blackScreenExitButton} ${isExitVisible ? styles.blackScreenExitButtonVisible : styles.blackScreenExitButtonHidden}`}
      />
    </div>
  );
};

export default BlackScreenOverlay;

