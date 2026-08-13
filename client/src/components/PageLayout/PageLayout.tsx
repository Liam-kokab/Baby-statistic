import { forwardRef, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import BlackScreenOverlay from '../BlackScreenOverlay/BlackScreenOverlay';
import DataFreshnessDot from '../DataFreshnessDot/DataFreshnessDot';
import BackupStatusDot from '../BackupStatusDot/BackupStatusDot';
import useBlackScreen from '../../utils/useBlackScreen';
import type { TDataFreshness } from '../../utils/useDataFreshness';
import { useTranslation } from '../../i18n/i18n';
import { BLACK_SCREEN_KEEP_AWAKE_MS } from '../../config';
import styles from './PageLayout.module.css';

type TGradient = 'pink' | 'blue' | 'green' | 'indigo' | 'amber';

/** CSSProperties extended to allow arbitrary `--custom-property` keys (dynamic CSS variables). */
type TCSSVarProperties = CSSProperties & Record<`--${string}`, string>;

type TProps = {
  title: string;
  emoji: string;
  children: ReactNode;
  gradient?: TGradient;
  bannerSlug?: string;
  /** When provided, shows the data-freshness dot (top-right of the banner) — see `useDataFreshness`. */
  dataFreshness?: TDataFreshness;
  /**
   * Called whenever the black-screen overlay opens/closes. Lets the page pause its own
   * `useRefetchOnVisible`/`useBabyUpdatesSocket` (via `enabled: !isBlackScreenOpen`) while the
   * overlay is up — otherwise a WS update would trigger both the page's own (hidden) refetch and
   * `BlackScreenOverlay`'s own `useAlwaysOnDisplayData` fetch/socket at once, and opening the
   * overlay would visibly add a second, redundant WebSocket connection alongside the page's own.
   */
  onBlackScreenOpenChange?: (isOpen: boolean) => void;
};

const PageLayout = forwardRef<HTMLDivElement, TProps>(({ title, emoji, children, gradient = 'pink', bannerSlug, dataFreshness, onBlackScreenOpenChange }, ref) => {
  const { t } = useTranslation();
  // `keepAwakeMs` matches HomePage's own `useBlackScreen` call so the black screen ("always on
  // display") behaves identically everywhere — same wake lock/keep-awake duration — no matter
  // which page it was opened from.
  const { isOpen: isBlackScreenOpen, isExitVisible: isBlackScreenExitVisible, isCursorVisible: isBlackScreenCursorVisible, open: openBlackScreen, close: closeBlackScreen, onPointerActivity: onBlackScreenPointerActivity } = useBlackScreen({ keepAwakeMs: BLACK_SCREEN_KEEP_AWAKE_MS });

  const onBlackScreenOpenChangeRef = useRef(onBlackScreenOpenChange);
  useEffect(() => {
    onBlackScreenOpenChangeRef.current = onBlackScreenOpenChange;
  });
  useEffect(() => {
    onBlackScreenOpenChangeRef.current?.(isBlackScreenOpen);
  }, [isBlackScreenOpen]);


  // create a safe slug from title to reference per-page CSS variables
  const slugSource = bannerSlug ?? title;
  const slug = slugSource
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const headerStyle: TCSSVarProperties = {
    '--hero-var': `var(--hero-bg-${slug})`,
    // Override the theme banner stops for this header by mapping the theme's per-page variables
    // to the standard banner variable names (e.g. --banner-pink-start).
    [`--banner-${gradient}-start`]: `var(--banner-${gradient}-${slug}-start, var(--banner-${gradient}-start))`,
    [`--banner-${gradient}-mid`]: `var(--banner-${gradient}-${slug}-mid, var(--banner-${gradient}-end))`,
    [`--banner-${gradient}-end`]: `var(--banner-${gradient}-${slug}-end, var(--banner-${gradient}-end))`,
  };

  return (
    <div className={styles.page} ref={ref}>
      <header className={`${styles.header} ${styles[gradient]}`} style={headerStyle}>
        {dataFreshness ? <DataFreshnessDot {...dataFreshness} /> : null}
        {dataFreshness ? <BackupStatusDot /> : null}
        <button
          type="button"
          className={styles.emojiButton}
          onClick={openBlackScreen}
          aria-label={t('HOME_BLACK_SCREEN_OPEN')}
        >
          <span className={styles.emoji}>{emoji}</span>
        </button>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.content}>{children}</div>

      <BlackScreenOverlay
        isOpen={isBlackScreenOpen}
        isExitVisible={isBlackScreenExitVisible}
        isCursorVisible={isBlackScreenCursorVisible}
        onPointerActivity={onBlackScreenPointerActivity}
        onClose={closeBlackScreen}
      />
    </div>
  );
});

PageLayout.displayName = 'PageLayout';

export default PageLayout;
