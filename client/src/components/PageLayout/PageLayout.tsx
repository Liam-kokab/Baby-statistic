import { forwardRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import styles from './PageLayout.module.css';

type TGradient = 'pink' | 'blue' | 'green' | 'indigo' | 'amber';

/** CSSProperties extended to allow arbitrary `--custom-property` keys (dynamic CSS variables). */
type TCSSVarProperties = CSSProperties & Record<`--${string}`, string>;

type TProps = {
  title: string;
  emoji: string;
  children: ReactNode;
  gradient?: TGradient;
};

const PageLayout = forwardRef<HTMLDivElement, TProps>(({ title, emoji, children, gradient = 'pink' }, ref) => {
  // create a safe slug from title to reference per-page CSS variables
  const slug = title
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
        <span className={styles.emoji}>{emoji}</span>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
});

PageLayout.displayName = 'PageLayout';

export default PageLayout;
