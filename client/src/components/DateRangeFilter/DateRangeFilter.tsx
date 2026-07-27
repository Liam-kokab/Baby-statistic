import { useTranslation } from '../../i18n/i18n';
import styles from './DateRangeFilter.module.css';

export type TView = 'item' | 'day' | 'week';

type TProps = {
  from: string;
  to: string;
  view: TView;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onViewChange: (v: TView) => void;
};

const DateRangeFilter = ({ from, to, view, onFromChange, onToChange, onViewChange }: TProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <div className={styles.dates}>
        <label className={styles.label}>
          {t('DATE_FILTER_FROM')}
          <input
            type="date"
            className={styles.dateInput}
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </label>
        <label className={styles.label}>
          {t('DATE_FILTER_TO')}
          <input
            type="date"
            className={styles.dateInput}
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </label>
      </div>
      <div className={styles.toggle}>
        <button
          type="button"
          className={`${styles.toggleBtn} ${view === 'item' ? styles.active : ''}`}
          onClick={() => onViewChange('item')}
        >
          {t('DATE_FILTER_ITEM_BY_ITEM')}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${view === 'day' ? styles.active : ''}`}
          onClick={() => onViewChange('day')}
        >
          {t('DATE_FILTER_DAY_BY_DAY')}
        </button>
        <button
          type="button"
          className={`${styles.toggleBtn} ${view === 'week' ? styles.active : ''}`}
          onClick={() => onViewChange('week')}
        >
          {t('DATE_FILTER_WEEK_BY_WEEK')}
        </button>
      </div>
    </div>
  );
};

export default DateRangeFilter;

