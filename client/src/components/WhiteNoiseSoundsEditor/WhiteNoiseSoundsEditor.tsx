import { useState } from 'react';
import Checkmark from '../Checkmark/Checkmark';
import { useTranslation } from '../../i18n/i18n';
import type { TNoiseType } from '../../utils/whiteNoise';
import { WHITE_NOISE_SOUNDS, getSelectedWhiteNoiseTypes, saveSelectedWhiteNoiseTypes } from '../../utils/homeWhiteNoiseWidgetPrefs';
import styles from './WhiteNoiseSoundsEditor.module.css';

const WhiteNoiseSoundsEditor = () => {
  const { t } = useTranslation();
  const [selectedTypes, setSelectedTypes] = useState<TNoiseType[]>(() => getSelectedWhiteNoiseTypes());

  const toggleType = (type: TNoiseType): void => {
    setSelectedTypes((prev) => {
      const next = prev.includes(type) ? prev.filter((t2) => t2 !== type) : [...prev, type];
      saveSelectedWhiteNoiseTypes(next);
      return next;
    });
  };

  return (
    <div className={styles.wrapper}>
      <p className={styles.description}>{t('SETTINGS_WHITE_NOISE_SOUNDS_DESCRIPTION')}</p>
      <div className={styles.checkRow}>
        {WHITE_NOISE_SOUNDS.map(({ type, emoji, titleKey }) => (
          <Checkmark
            key={type}
            checked={selectedTypes.includes(type)}
            onChange={() => toggleType(type)}
            label={`${emoji} ${t(titleKey)}`}
          />
        ))}
      </div>
    </div>
  );
};

export default WhiteNoiseSoundsEditor;

