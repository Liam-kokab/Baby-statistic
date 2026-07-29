import styles from './Tabs.module.css';

export type TTabItem = {
  key: string;
  label: string;
  emoji?: string;
};

type TProps = {
  tabs: TTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
};

const Tabs = ({ tabs, activeKey, onChange }: TProps) => (
  <div className={styles.tabs} role="tablist">
    {tabs.map(({ key, label, emoji }) => (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={key === activeKey}
        className={`${styles.tab} ${key === activeKey ? styles.active : ''}`}
        onClick={() => onChange(key)}
      >
        {emoji ? <span className={styles.emoji}>{emoji}</span> : null}
        <span>{label}</span>
      </button>
    ))}
  </div>
);

export default Tabs;

