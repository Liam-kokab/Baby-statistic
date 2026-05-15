import styles from './Button.module.css';
import type { TActionStatus } from '../../utils/useActionFeedback';

type TVariant = 'primary' | 'secondary' | 'ghost';

type TProps = {
  text?: string;
  emoji?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  status?: TActionStatus;
  variant?: TVariant;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
};

const STATUS_EMOJI: Record<'success' | 'error', string> = {
  success: '✅',
  error:   '❌',
};

const Button = ({
  text,
  emoji,
  onClick,
  disabled = false,
  loading = false,
  status,
  variant = 'primary',
  type = 'button',
  className,
}: TProps) => {
  const resolved: TActionStatus = status ?? (loading ? 'loading' : 'idle');
  const isLoading  = resolved === 'loading';
  const isSuccess  = resolved === 'success';
  const isError    = resolved === 'error';
  const isDisabled = disabled || isLoading || isSuccess || isError;

  const cls = [
    styles.button,
    styles[variant],
    isLoading ? styles.loading  : '',
    isSuccess ? styles.success  : '',
    isError   ? styles.error    : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  const displayEmoji = isSuccess ? STATUS_EMOJI.success
    : isError   ? STATUS_EMOJI.error
    : emoji;

  return (
    <button type={type} className={cls} onClick={onClick} disabled={isDisabled}>
      {isLoading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : displayEmoji ? (
        <span className={styles.emoji}>{displayEmoji}</span>
      ) : null}
      {text ? <span>{text}</span> : null}
    </button>
  );
};

export default Button;

