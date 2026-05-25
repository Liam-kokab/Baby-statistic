import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import styles from './Toggle.module.css';

type TProps = {
  options: string[]; // 2..4 items
  value?: number; // controlled selected index
  defaultIndex?: number; // uncontrolled initial index
  onChange?: (index: number) => void;
  name?: string;
  className?: string;
};

const clampOptions = (opts: string[]): string[] => {
  if (opts.length <= 4 && opts.length >= 2) return opts;
  if (opts.length > 4) return opts.slice(0, 4);
  // pad with empty strings if too few
  const copy = opts.slice();
  while (copy.length < 2) copy.push('');
  return copy;
};

const Toggle = ({ options, value, defaultIndex = 0, onChange, name, className }: TProps) => {
  const safeOptions = clampOptions(options);
  const isControlled = typeof value === 'number';
  const [internalIndex, setInternalIndex] = useState<number>(() =>
    Math.max(0, Math.min(defaultIndex ?? 0, safeOptions.length - 1))
  );
  useEffect(() => {
    // keep internal within bounds if options change
    setInternalIndex((i) => Math.max(0, Math.min(i, safeOptions.length - 1)));
  }, [safeOptions.length]);

  const selectedIndex = isControlled ? (value ?? 0) : internalIndex;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cols = safeOptions.length;
  const thumbWidthPercent = 100 / cols;
  const thumbTranslate = selectedIndex * 100;

  const handleSelect = (i: number): void => {
    if (!isControlled) setInternalIndex(i);
    onChange?.(i);
  };

  const focusButton = (i: number): void => {
    const node = rootRef.current?.querySelectorAll('button')[i] as HTMLButtonElement | undefined;
    node?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(e.key)) return;
    e.preventDefault();
    const len = safeOptions.length;
    let next = selectedIndex;
    if (e.key === 'ArrowLeft') next = (selectedIndex - 1 + len) % len;
    if (e.key === 'ArrowRight') next = (selectedIndex + 1) % len;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = len - 1;
    if (e.key === 'Enter' || e.key === ' ') {
      // space/enter should toggle the currently focused button
      const focused = Array.from(rootRef.current?.querySelectorAll('button') ?? []).findIndex((n) => n === document.activeElement);
      if (focused >= 0) next = focused;
    }
    handleSelect(next);
    focusButton(next);
  };

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-label={name ?? 'toggle'}
      onKeyDown={handleKeyDown}
      className={`${styles.toggle} ${styles['cols' + safeOptions.length]} ${className ?? ''}`.trim()}
    >
      <div
        className={styles.thumb}
        aria-hidden="true"
        style={{ width: `${thumbWidthPercent}%`, transform: `translateX(${thumbTranslate}%)` }}
      />
      {safeOptions.map((label, i) => {
        const active = i === selectedIndex;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-pressed={active}
            aria-selected={active}
            className={`${styles.segment} ${active ? styles.active : ''}`.trim()}
            onClick={() => handleSelect(i)}
          >
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default Toggle;

