import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import styles from './PageLayout.module.css';

type TGradient = 'pink' | 'blue' | 'green' | 'indigo' | 'amber';

type TProps = {
  title: string;
  emoji: string;
  children: ReactNode;
  gradient?: TGradient;
};

const PageLayout = forwardRef<HTMLDivElement, TProps>(({ title, emoji, children, gradient = 'pink' }, ref) => (
  <div className={styles.page} ref={ref}>
    <header className={`${styles.header} ${styles[gradient]}`}>
      <span className={styles.emoji}>{emoji}</span>
      <h1 className={styles.title}>{title}</h1>
    </header>
    <div className={styles.content}>{children}</div>
  </div>
));

PageLayout.displayName = 'PageLayout';

export default PageLayout;
