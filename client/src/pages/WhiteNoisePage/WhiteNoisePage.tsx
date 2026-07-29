import {useCallback, useEffect} from 'react';
import Button from '../../components/Button/Button';
import PageLayout from '../../components/PageLayout/PageLayout';
import {useTranslation} from '../../i18n/i18n';
import type {TNoiseType} from '../../utils/whiteNoise';
import {whiteNoisePlayer} from '../../utils/whiteNoise';
import {useWhiteNoisePlayerState} from '../../utils/useWhiteNoisePlayerState';
import {WHITE_NOISE_DURATION_OPTIONS, formatWhiteNoiseRemaining} from '../../utils/whiteNoiseDurations';
import styles from './WhiteNoisePage.module.css';

type TSound = {
  type: TNoiseType;
  emoji: string;
  titleKey: string;
};

const SOUNDS: TSound[] = [
  { type: 'white', emoji: '📻', titleKey: 'WHITE_NOISE_PAGE_WHITE' },
  { type: 'fan',   emoji: '🌀', titleKey: 'WHITE_NOISE_PAGE_FAN' },
  { type: 'wave',  emoji: '🌊', titleKey: 'WHITE_NOISE_PAGE_WAVE' },
  { type: 'hush',  emoji: '🤫', titleKey: 'WHITE_NOISE_PAGE_HUSH' },
];

const WhiteNoisePage = () => {
  const { t } = useTranslation();
  const { playingType, endAt, activeDuration } = useWhiteNoisePlayerState();

  useEffect(() => {
    return () => whiteNoisePlayer.stop();
  }, []);

  const handlePlay = useCallback((type: TNoiseType, minutes: number | null): void => {
    whiteNoisePlayer.play(type, minutes);
  }, []);

  const handleStop = useCallback((): void => {
    whiteNoisePlayer.stop();
  }, []);

  return (
    <PageLayout title={t('WHITE_NOISE_PAGE_TITLE')} emoji="🎧" gradient="blue">
      <div className={styles.list}>
        {SOUNDS.map(({ type, emoji, titleKey }) => (
          <section key={type} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardEmoji}>{emoji}</span>
              <h2 className={styles.cardTitle}>{t(titleKey)}</h2>
            </div>
            <div className={styles.btnRow}>
              {WHITE_NOISE_DURATION_OPTIONS.map((option) => {
                const isActive = playingType === type && activeDuration === option.minutes;
                const text = isActive
                  ? (option.minutes !== null && endAt !== null ? formatWhiteNoiseRemaining(endAt) : t('WHITE_NOISE_PAGE_STOP'))
                  : t(option.labelKey);
                return (
                  <Button
                    key={option.labelKey}
                    text={text}
                    emoji={isActive ? '⏹️' : option.emoji}
                    onClick={() => (isActive ? handleStop() : handlePlay(type, option.minutes))}
                    variant={isActive ? 'primary' : 'secondary'}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
};

export default WhiteNoisePage;



