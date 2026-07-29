import { useState } from 'react';
import Button from '../Button/Button';
import { useTranslation } from '../../i18n/i18n';
import { USER_FEATURE_ITEMS, VISIBLE_FEATURE_COUNT, type TNavItem } from '../../utils/navItems';
import { getSavedNavOrder, saveNavOrder, clearNavOrder, applyNavOrder } from '../../utils/navOrder';
import styles from './NavOrderEditor.module.css';

const NavOrderEditor = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TNavItem[]>(() => applyNavOrder(USER_FEATURE_ITEMS, getSavedNavOrder()));

  const persist = (next: TNavItem[]): void => {
    setItems(next);
    saveNavOrder(next.map((item) => item.path));
  };

  const moveUp = (index: number): void => {
    if (index <= 0) return;
    const next = items.slice();
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    persist(next);
  };

  const moveDown = (index: number): void => {
    if (index >= items.length - 1) return;
    const next = items.slice();
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    persist(next);
  };

  const handleReset = (): void => {
    clearNavOrder();
    setItems(applyNavOrder(USER_FEATURE_ITEMS, null));
  };

  return (
    <div className={styles.wrapper}>
      <p className={styles.description}>
        {t('SETTINGS_NAV_ORDER_DESCRIPTION', { count: VISIBLE_FEATURE_COUNT })}
      </p>
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={item.path} className={styles.item}>
            <span className={styles.itemEmoji}>{item.emoji}</span>
            <span className={styles.itemLabel}>{t(item.labelKey)}</span>
            <span className={index < VISIBLE_FEATURE_COUNT ? styles.badgeVisible : styles.badgeMenu}>
              {index < VISIBLE_FEATURE_COUNT ? t('SETTINGS_NAV_ORDER_VISIBLE') : t('SETTINGS_NAV_ORDER_IN_MENU')}
            </span>
            <div className={styles.itemActions}>
              <Button emoji="⬆️" variant="ghost" onClick={() => moveUp(index)} disabled={index === 0} />
              <Button emoji="⬇️" variant="ghost" onClick={() => moveDown(index)} disabled={index === items.length - 1} />
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button text={t('SETTINGS_NAV_ORDER_RESET')} variant="secondary" onClick={handleReset} />
      </div>
    </div>
  );
};

export default NavOrderEditor;

