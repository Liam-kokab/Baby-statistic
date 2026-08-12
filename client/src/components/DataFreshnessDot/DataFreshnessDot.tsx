import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/i18n';
import type { TDataFreshness } from '../../utils/useDataFreshness';
import styles from './DataFreshnessDot.module.css';

type TProps = TDataFreshness;

/** Below this age the dot is green ("fresh"). */
const GREEN_MAX_MS = 5 * 60_000;
/** Below this age (and above GREEN_MAX_MS) the dot is yellow ("getting stale"). */
const YELLOW_MAX_MS = 20 * 60_000;
/** How often the dot re-evaluates its color/tooltip against the current time, even without new data. */
const TICK_MS = 15_000;

type TFreshnessStatus = 'green' | 'yellow' | 'red';

/**
 * Small colored dot shown in the top-right of every page's banner, indicating how old the
 * page's data is: green (< 5 min), yellow (< 20 min), red (≥ 20 min or the last fetch failed).
 * Hovering (native `title` tooltip) shows the exact age and what the dot represents.
 */
const DataFreshnessDot = ({ lastUpdatedAt, isError }: TProps) => {
  const { t } = useTranslation();
  // Forces a re-render every TICK_MS so the color/tooltip age keeps advancing even when
  // lastUpdatedAt/isError haven't changed (i.e. no new fetch has happened).
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const ageMs = lastUpdatedAt !== null ? Date.now() - lastUpdatedAt : null;

  const status: TFreshnessStatus =
    isError || ageMs === null || ageMs > YELLOW_MAX_MS
      ? 'red'
      : ageMs > GREEN_MAX_MS
        ? 'yellow'
        : 'green';

  const ageLabel = (): string => {
    if (ageMs === null) return t('DATA_FRESHNESS_UNKNOWN');
    const totalMin = Math.floor(ageMs / 60_000);
    if (totalMin < 1) return t('DATA_FRESHNESS_JUST_NOW');
    return t('DATA_FRESHNESS_AGE_MINUTES', { m: totalMin });
  };

  const tooltip = isError
    ? t('DATA_FRESHNESS_TOOLTIP_ERROR', { age: ageLabel() })
    : t('DATA_FRESHNESS_TOOLTIP_OK', { age: ageLabel() });

  return (
    <span className={styles.wrapper} title={tooltip} aria-label={tooltip}>
      <span className={`${styles.dot} ${styles[status]}`} />
    </span>
  );
};

export default DataFreshnessDot;

