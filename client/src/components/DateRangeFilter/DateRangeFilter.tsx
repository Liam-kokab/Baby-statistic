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

const DateRangeFilter = ({ from, to, view, onFromChange, onToChange, onViewChange }: TProps) => (
  <div className={styles.container}>
    <div className={styles.dates}>
      <label className={styles.label}>
        From
        <input
          type="date"
          className={styles.dateInput}
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </label>
      <label className={styles.label}>
        To
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
        📋 Item by item
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${view === 'day' ? styles.active : ''}`}
        onClick={() => onViewChange('day')}
      >
        📅 Day by day
      </button>
      <button
        type="button"
        className={`${styles.toggleBtn} ${view === 'week' ? styles.active : ''}`}
        onClick={() => onViewChange('week')}
      >
        📆 Week by week
      </button>
    </div>
  </div>
);

export default DateRangeFilter;

