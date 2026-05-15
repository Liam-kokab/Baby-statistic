import type { ReactNode } from 'react';
import styles from './PageLayout.module.css';

type TGradient = 'pink' | 'blue' | 'green' | 'indigo' | 'amber';

type TProps = {
  title: string;
  emoji: string;
  children: ReactNode;
  gradient?: TGradient;
};

const PageLayout = ({ title, emoji, children, gradient = 'pink' }: TProps) => (
  <div className={styles.page}>
    <header className={`${styles.header} ${styles[gradient]}`}>
      <span className={styles.emoji}>{emoji}</span>
      <h1 className={styles.title}>{title}</h1>
    </header>
    <div className={styles.content}>{children}</div>
  </div>
);

export default PageLayout;

