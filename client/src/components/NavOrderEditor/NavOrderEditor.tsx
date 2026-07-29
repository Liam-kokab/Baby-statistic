import { useState } from 'react';
import Button from '../Button/Button';
import Checkmark from '../Checkmark/Checkmark';
import { useTranslation } from '../../i18n/i18n';
import { USER_FEATURE_ITEMS, VISIBLE_FEATURE_COUNT, type TNavItem } from '../../utils/navItems';
import {
  getSavedNavOrder,
  saveNavOrder,
  clearNavOrder,
  applyNavOrder,
  getHiddenNavItems,
  saveHiddenNavItems,
  clearHiddenNavItems,
} from '../../utils/navOrder';
import styles from './NavOrderEditor.module.css';

const NavOrderEditor = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TNavItem[]>(() => applyNavOrder(USER_FEATURE_ITEMS, getSavedNavOrder()));
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(getHiddenNavItems()));

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

  const toggleHidden = (path: string): void => {
    const next = new Set(hidden);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setHidden(next);
    saveHiddenNavItems(Array.from(next));
  };

  const handleReset = (): void => {
    clearNavOrder();
    clearHiddenNavItems();
    setItems(applyNavOrder(USER_FEATURE_ITEMS, null));
    setHidden(new Set());
  };

  // Visible-vs-menu position is computed only over the items the user hasn't hidden,
  // matching how NavBar itself slices the (already-filtered) ordered list.
  const isOnBarByPath = new Map<string, boolean>();
  items
    .filter((item) => !hidden.has(item.path))
    .forEach((item, visibleIndex) => isOnBarByPath.set(item.path, visibleIndex < VISIBLE_FEATURE_COUNT));

  return (
    <div className={styles.wrapper}>
      <p className={styles.description}>
        {t('SETTINGS_NAV_ORDER_DESCRIPTION', { count: VISIBLE_FEATURE_COUNT })}
      </p>
      <ul className={styles.list}>
        {items.map((item, index) => {
          const isHidden = hidden.has(item.path);
          const isOnBar = isOnBarByPath.get(item.path) ?? false;
          return (
            <li key={item.path} className={styles.item}>
              <Checkmark checked={!isHidden} onChange={() => toggleHidden(item.path)} />
              <span className={styles.itemEmoji}>{item.emoji}</span>
              <span className={styles.itemLabel}>{t(item.labelKey)}</span>
              {!isHidden ? (
                <span className={isOnBar ? styles.badgeVisible : styles.badgeMenu}>
                  {isOnBar ? t('SETTINGS_NAV_ORDER_VISIBLE') : t('SETTINGS_NAV_ORDER_IN_MENU')}
                </span>
              ) : null}
              <div className={styles.itemActions}>
                <Button emoji="⬆️" variant="ghost" onClick={() => moveUp(index)} disabled={index === 0} />
                <Button emoji="⬇️" variant="ghost" onClick={() => moveDown(index)} disabled={index === items.length - 1} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className={styles.actions}>
        <Button text={t('SETTINGS_NAV_ORDER_RESET')} variant="secondary" onClick={handleReset} />
      </div>
    </div>
  );
};

export default NavOrderEditor;




