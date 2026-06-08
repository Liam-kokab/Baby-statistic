import styles from './Checkmark.module.css';

type TProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

const Checkmark = ({ checked, onChange, label, disabled }: TProps) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`${styles.checkmark} ${checked ? styles.checked : styles.unchecked}`}
    onClick={() => onChange(!checked)}
  >
    <span className={styles.box} aria-hidden="true" />
    {label ? <span className={styles.labelText}>{label}</span> : null}
  </button>
);

export default Checkmark;

