import styles from './DateTimeInput.module.css';

type TProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  name?: string;
};

const DateTimeInput = ({ label, value, onChange, disabled = false, error, name }: TProps) => (
  <div className={styles.wrapper}>
    {label ? <label className={styles.label} htmlFor={name}>{label}</label> : null}
    <input
      id={name}
      className={`${styles.input}${error ? ` ${styles.hasError}` : ''}`}
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      name={name}
    />
    {error ? <span className={styles.error}>{error}</span> : null}
  </div>
);

export default DateTimeInput;

