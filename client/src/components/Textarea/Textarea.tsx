import styles from './Textarea.module.css';

type TProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  name?: string;
  rows?: number;
};

const Textarea = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  name,
  rows = 4,
}: TProps) => (
  <div className={styles.wrapper}>
    {label ? <label className={styles.label} htmlFor={name}>{label}</label> : null}
    <textarea
      id={name}
      className={`${styles.textarea}${error ? ` ${styles.hasError}` : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      name={name}
      rows={rows}
    />
    {error ? <span className={styles.error}>{error}</span> : null}
  </div>
);

export default Textarea;

