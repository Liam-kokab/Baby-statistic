import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
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
  const [measured, setMeasured] = useState<number[] | null>(null);
  const [thumbPx, setThumbPx] = useState<{ width: number; translate: number } | null>(null);
  const [displayMode, setDisplayMode] = useState<'full' | 'text-only' | 'icon-only'>('full');

  const parseLabel = (label: string): { icon: string; text: string; hasIcon: boolean } => {
    const firstSpace = label.indexOf(' ');
    let icon = '';
    let text = label;
    if (firstSpace > 0) {
      const first = label.slice(0, firstSpace);
      // crude emoji detection: check common emoji ranges
      const emojiRe = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      if (emojiRe.test(first) || /[^\w\s]/.test(first)) {
        icon = first;
        text = label.slice(firstSpace + 1);
      }
    }
    return { icon, text, hasIcon: icon.length > 0 };
  };

  const escapeHtml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // measure intrinsic widths of each button (by cloning) so we can allocate
  // proportional flex-grow values and position the thumb precisely.
  const measure = (): void => {
    const root = rootRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll('button')) as HTMLElement[];
    if (buttons.length === 0) return;
    // measure three variants: full, text-only (no icon), icon-only
    const fullWidths: number[] = [];
    const textOnlyWidths: number[] = [];
    const iconOnlyWidths: number[] = [];

    const makeTmp = (html: string, srcBtn: HTMLElement) => {
      const tmp = document.createElement('button');
      tmp.className = srcBtn.className;
      tmp.style.position = 'absolute';
      tmp.style.visibility = 'hidden';
      tmp.style.height = 'auto';
      tmp.style.width = 'auto';
      tmp.style.whiteSpace = 'nowrap';
      tmp.style.pointerEvents = 'none';
      tmp.innerHTML = html;
      document.body.appendChild(tmp);
      const w = tmp.getBoundingClientRect().width;
      document.body.removeChild(tmp);
      return w || 0;
    };

    buttons.forEach((btn, idx) => {
      const label = safeOptions[idx] ?? btn.textContent ?? '';
      const { icon, text, hasIcon } = parseLabel(label.toString());
      const fullHtml = `<span class="${styles.label}">${escapeHtml(label.toString())}</span>`;
      const textOnlyHtml = hasIcon
        ? `<span class="${styles.label}">${escapeHtml(text)}</span>`
        : fullHtml;
      const iconOnlyHtml = hasIcon
        ? `<span class="${styles.label}">${escapeHtml(icon)}</span>`
        : `<span class="${styles.label}">${escapeHtml(text.slice(0, 1) ?? label.toString())}</span>`;
      fullWidths.push(makeTmp(fullHtml, btn));
      textOnlyWidths.push(makeTmp(textOnlyHtml, btn));
      iconOnlyWidths.push(makeTmp(iconOnlyHtml, btn));
    });

    // determine available content width
    const rootRect = root.getBoundingClientRect();
    const cs = getComputedStyle(root);
    const padLeft = parseFloat(cs.paddingLeft || '0') || 0;
    const padRight = parseFloat(cs.paddingRight || '0') || 0;
    const gapPx = parseFloat(cs.gap || cs.columnGap || '0') || 0;
    const contentWidth = Math.max(rootRect.width - padLeft - padRight - gapPx * (buttons.length - 1), 1);

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    let chosenVariant: 'full' | 'text-only' | 'icon-only';
    if (sum(fullWidths) <= contentWidth) chosenVariant = 'full';
    else if (sum(textOnlyWidths) <= contentWidth) chosenVariant = 'text-only';
    else chosenVariant = 'icon-only';

    const chosenWidths = chosenVariant === 'full' ? fullWidths : chosenVariant === 'text-only' ? textOnlyWidths : iconOnlyWidths;
    setDisplayMode(chosenVariant as any);
    setMeasured(chosenWidths);

    // compute allocated px for thumb
    const totalMeasured = sum(chosenWidths) || 1;
    const scale = contentWidth / totalMeasured;
    const allocated = chosenWidths.map((w) => w * scale);
    const translate = padLeft + allocated.slice(0, selectedIndex).reduce((a, b) => a + b, 0) + gapPx * selectedIndex;
    const w = allocated[selectedIndex] || 0;
    setThumbPx({ width: w, translate });
  };

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(() => measure());
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeOptions.length]);

  // Recompute thumb translate when selection changes (allocated sizes remain same)
  useEffect(() => {
    if (!measured || !rootRef.current) return;
    const root = rootRef.current;
    const cs = getComputedStyle(root);
    const padLeft = parseFloat(cs.paddingLeft || '0') || 0;
    const padRight = parseFloat(cs.paddingRight || '0') || 0;
    const gapPx = parseFloat(cs.gap || cs.columnGap || '0') || 0;
    const totalMeasured = measured.reduce((a, b) => a + b, 0) || 1;
    const rootRect = root.getBoundingClientRect();
    const contentWidth = Math.max(rootRect.width - padLeft - padRight - gapPx * (measured.length - 1), 1);
    const scale = contentWidth / totalMeasured;
    const allocated = measured.map((w) => w * scale);
    const translate = padLeft + allocated.slice(0, selectedIndex).reduce((a, b) => a + b, 0) + gapPx * selectedIndex;
    const w = allocated[selectedIndex] || 0;
    setThumbPx({ width: w, translate });
  }, [selectedIndex, measured]);

  const cols = safeOptions.length;
  // Default equal-percent fallback
  let thumbWidthStyle: string = `${100 / cols}%`;
  let thumbTransformStyle: string = `translateX(${selectedIndex * (100 / cols)}%)`;
  if (thumbPx) {
    // use pixel-based positioning when available for perfect alignment
    thumbWidthStyle = `${thumbPx.width}px`;
    thumbTransformStyle = `translateX(${thumbPx.translate}px)`;
  }

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
      className={`${styles.toggle} ${className ?? ''}`.trim()}
    >
      <div
        className={styles.thumb}
        aria-hidden="true"
        style={{ width: thumbWidthStyle, transform: thumbTransformStyle }}
      />
      {safeOptions.map((label, i) => {
        const active = i === selectedIndex;
        const { icon, text, hasIcon } = parseLabel(label);
        const showIcon = displayMode === 'full' || displayMode === 'icon-only';
        const showText = displayMode === 'full' || displayMode === 'text-only';
        const showIconOnly = displayMode === 'icon-only';
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-pressed={active}
            aria-selected={active}
            title={label}
            aria-label={label}
            className={`${styles.segment} ${active ? styles.active : ''}`.trim()}
            onClick={() => handleSelect(i)}
            // set proportional flex using measured widths (fallback to equal)
            style={
              measured && measured.length === cols
                ? ({ flexGrow: measured[i], flexShrink: 1, flexBasis: '0%' } as any)
                : ({ flex: '1 1 0%' } as any)
            }
          >
            {showIcon && hasIcon ? <span className={styles.icon}>{icon}</span> : null}
            {showText ? <span className={styles.text}>{hasIcon && showIconOnly ? text?.slice(0, 1) ?? '' : (hasIcon ? text : label)}</span> : null}
          </button>
        );
      })}
    </div>
  );
};

export default Toggle;

