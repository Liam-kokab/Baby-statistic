import { forwardRef, useEffect, useRef, useState, type MouseEvent } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Button from '../Button/Button';
import { useTranslation } from '../../i18n/i18n';
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
};

const PageLayout = forwardRef<HTMLDivElement, TProps>(({ title, emoji, children, gradient = 'pink', bannerSlug }, ref) => {
  const { t } = useTranslation();
  const blackScreenExitTimeoutRef = useRef<number | null>(null);
  const blackScreenCursorTimeoutRef = useRef<number | null>(null);
  const [isBlackScreenOpen, setIsBlackScreenOpen] = useState<boolean>(false);
  const [isBlackScreenExitVisible, setIsBlackScreenExitVisible] = useState<boolean>(false);
  const [isBlackScreenCursorVisible, setIsBlackScreenCursorVisible] = useState<boolean>(true);

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

  const clearBlackScreenExitTimeout = (): void => {
    if (blackScreenExitTimeoutRef.current !== null) {
      clearTimeout(blackScreenExitTimeoutRef.current);
      blackScreenExitTimeoutRef.current = null;
    }
  };

  const clearBlackScreenCursorTimeout = (): void => {
    if (blackScreenCursorTimeoutRef.current !== null) {
      clearTimeout(blackScreenCursorTimeoutRef.current);
      blackScreenCursorTimeoutRef.current = null;
    }
  };

  const enterFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement !== null) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Browser fullscreen may be blocked; keep the overlay available either way.
    }
  };

  const exitFullscreen = async (): Promise<void> => {
    if (document.fullscreenElement === null) return;
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore exit failures; overlay state is still cleared.
    }
  };

  const showBlackScreenExit = (): void => {
    setIsBlackScreenExitVisible(true);
    setIsBlackScreenCursorVisible(true);
    clearBlackScreenExitTimeout();
    blackScreenExitTimeoutRef.current = window.setTimeout(() => {
      setIsBlackScreenExitVisible(false);
      blackScreenExitTimeoutRef.current = null;
    }, 1000);

    clearBlackScreenCursorTimeout();
    blackScreenCursorTimeoutRef.current = window.setTimeout(() => {
      setIsBlackScreenCursorVisible(false);
      blackScreenCursorTimeoutRef.current = null;
    }, 2000);
  };

  const handleOpenBlackScreen = (): void => {
    clearBlackScreenExitTimeout();
    clearBlackScreenCursorTimeout();
    setIsBlackScreenExitVisible(false);
    setIsBlackScreenCursorVisible(true);
    setIsBlackScreenOpen(true);
    void enterFullscreen();
  };

  const handleCloseBlackScreen = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    clearBlackScreenExitTimeout();
    clearBlackScreenCursorTimeout();
    setIsBlackScreenExitVisible(false);
    setIsBlackScreenCursorVisible(true);
    setIsBlackScreenOpen(false);
    void exitFullscreen();
  };

  useEffect(() => {
    return () => {
      clearBlackScreenExitTimeout();
      clearBlackScreenCursorTimeout();
      void exitFullscreen();
    };
  }, []);

  return (
    <div className={styles.page} ref={ref}>
      <header className={`${styles.header} ${styles[gradient]}`} style={headerStyle}>
        <button
          type="button"
          className={styles.emojiButton}
          onClick={handleOpenBlackScreen}
          aria-label={t('HOME_BLACK_SCREEN_OPEN')}
        >
          <span className={styles.emoji}>{emoji}</span>
        </button>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.content}>{children}</div>

      {isBlackScreenOpen ? (
        <div
          className={`${styles.blackScreenOverlay} ${isBlackScreenCursorVisible ? styles.blackScreenCursorVisible : styles.blackScreenCursorHidden}`}
          onClick={showBlackScreenExit}
          onMouseMove={showBlackScreenExit}
          onTouchStart={showBlackScreenExit}
          aria-label={t('HOME_BLACK_SCREEN_OVERLAY')}
        >
          <Button
            text={t('HOME_BLACK_SCREEN_EXIT')}
            onClick={handleCloseBlackScreen}
            aria-label={t('HOME_BLACK_SCREEN_EXIT')}
            variant="primary"
            className={`${styles.blackScreenExitButton} ${isBlackScreenExitVisible ? styles.blackScreenExitButtonVisible : styles.blackScreenExitButtonHidden}`}
          />
        </div>
      ) : null}
    </div>
  );
});

PageLayout.displayName = 'PageLayout';

export default PageLayout;
