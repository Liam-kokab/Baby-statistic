import { useState } from 'react';
import Checkmark from '../Checkmark/Checkmark';
import Button from '../Button/Button';
import { useTranslation } from '../../i18n/i18n';
import { DEFAULT_HOME_WIDGETS } from '../../utils/homeWidgets';
import type { THomeWidgetItem } from '../../utils/homeWidgets';
import {
  getSavedHomeWidgetOrder,
  saveHomeWidgetOrder,
  clearHomeWidgetOrder,
  applyHomeWidgetOrder,
  getHiddenHomeWidgets,
  saveHiddenHomeWidgets,
  clearHiddenHomeWidgets,
} from '../../utils/homeWidgetPrefs';
import styles from './HomeWidgetsEditor.module.css';

const HomeWidgetsEditor = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<THomeWidgetItem[]>(() =>
    applyHomeWidgetOrder(DEFAULT_HOME_WIDGETS, getSavedHomeWidgetOrder())
  );
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(getHiddenHomeWidgets()));

  const persistOrder = (next: THomeWidgetItem[]): void => {
    setItems(next);
    saveHomeWidgetOrder(next.map((item) => item.key));
  };

  const moveUp = (index: number): void => {
    if (index <= 0) return;
    const next = items.slice();
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    persistOrder(next);
  };

  const moveDown = (index: number): void => {
    if (index >= items.length - 1) return;
    const next = items.slice();
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    persistOrder(next);
  };

  const toggleHidden = (key: string): void => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
    saveHiddenHomeWidgets(Array.from(next));
  };

  const handleReset = (): void => {
    clearHomeWidgetOrder();
    clearHiddenHomeWidgets();
    setItems(applyHomeWidgetOrder(DEFAULT_HOME_WIDGETS, null));
    setHidden(new Set(getHiddenHomeWidgets()));
  };

  return (
    <div className={styles.wrapper}>
      <p className={styles.description}>{t('SETTINGS_HOME_WIDGETS_DESCRIPTION')}</p>
      <ul className={styles.list}>
        {items.map((item, index) => (
          <li key={item.key} className={styles.item}>
            <Checkmark checked={!hidden.has(item.key)} onChange={() => toggleHidden(item.key)} />
            <span className={styles.itemLabel}>{t(item.labelKey)}</span>
            <div className={styles.itemActions}>
              <Button emoji="⬆️" variant="ghost" onClick={() => moveUp(index)} disabled={index === 0} />
              <Button emoji="⬇️" variant="ghost" onClick={() => moveDown(index)} disabled={index === items.length - 1} />
            </div>
          </li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button text={t('SETTINGS_HOME_WIDGETS_RESET')} variant="secondary" onClick={handleReset} />
      </div>
    </div>
  );
};

export default HomeWidgetsEditor;

