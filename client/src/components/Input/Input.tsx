import styles from './Input.module.css';

type TInputType = 'text' | 'tel';

type TProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  type?: TInputType;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  name?: string;
};

const Input = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  error,
  name,
}: TProps) => (
  <div className={styles.wrapper}>
    {label ? <label className={styles.label} htmlFor={name}>{label}</label> : null}
    <input
      id={name}
      className={`${styles.input}${error ? ` ${styles.hasError}` : ''}`}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      name={name}
    />
    {error ? <span className={styles.error}>{error}</span> : null}
  </div>
);

export default Input;

