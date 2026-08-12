import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/i18n';
import useBackupStatus from '../../utils/useBackupStatus';
import styles from './BackupStatusDot.module.css';

/** Below this age the dot is green ("recently backed up"). */
const GREEN_MAX_MS = 6 * 60 * 60_000;
/** Below this age (and above GREEN_MAX_MS) the dot is yellow ("getting stale"). */
const YELLOW_MAX_MS = 12 * 60 * 60_000;
/** How often the dot re-evaluates its color/tooltip against the current time, even without a new fetch. */
const TICK_MS = 60_000;

type TBackupStatusColor = 'green' | 'yellow' | 'red';

/**
 * Small colored dot shown beside `DataFreshnessDot`, indicating how long ago the last
 * successful backup was reported by the backup-lambda: green (< 6h), yellow (< 12h),
 * red (≥ 12h, or no successful backup has ever been reported / the status fetch failed).
 */
const BackupStatusDot = () => {
  const { t } = useTranslation();
  const { lastBackupAt, isError } = useBackupStatus();
  // Forces a re-render every TICK_MS so the color/tooltip age keeps advancing even when
  // lastBackupAt hasn't changed (i.e. no new poll has happened yet).
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const ageMs = lastBackupAt !== null ? Date.now() - lastBackupAt : null;

  const status: TBackupStatusColor =
    isError || ageMs === null || ageMs > YELLOW_MAX_MS
      ? 'red'
      : ageMs > GREEN_MAX_MS
        ? 'yellow'
        : 'green';

  const ageLabel = (): string => {
    if (ageMs === null) return t('BACKUP_STATUS_NEVER');
    const totalHours = Math.floor(ageMs / (60 * 60_000));
    if (totalHours < 1) return t('BACKUP_STATUS_JUST_NOW');
    return t('BACKUP_STATUS_AGE_HOURS', { h: totalHours });
  };

  const tooltip = isError
    ? t('BACKUP_STATUS_TOOLTIP_ERROR', { age: ageLabel() })
    : t('BACKUP_STATUS_TOOLTIP_OK', { age: ageLabel() });

  return (
    <span className={styles.wrapper} title={tooltip} aria-label={tooltip}>
      <span className={`${styles.dot} ${styles[status]}`} />
    </span>
  );
};

export default BackupStatusDot;

