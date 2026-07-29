import {useCallback, useEffect, useState} from 'react';
import Button from '../../components/Button/Button';
import PageLayout from '../../components/PageLayout/PageLayout';
import {useTranslation} from '../../i18n/i18n';
import type {TNoiseType} from '../../utils/whiteNoise';
import {whiteNoisePlayer} from '../../utils/whiteNoise';
import styles from './WhiteNoisePage.module.css';

type TSound = {
  type: TNoiseType;
  emoji: string;
  titleKey: string;
};

type TDurationOption = {
  minutes: number | null;
  labelKey: string;
  emoji: string;
};

const SOUNDS: TSound[] = [
  { type: 'white', emoji: '📻', titleKey: 'WHITE_NOISE_PAGE_WHITE' },
  { type: 'fan',   emoji: '🌀', titleKey: 'WHITE_NOISE_PAGE_FAN' },
  { type: 'wave',  emoji: '🌊', titleKey: 'WHITE_NOISE_PAGE_WAVE' },
];

const DURATION_OPTIONS: TDurationOption[] = [
  { minutes: null, labelKey: 'WHITE_NOISE_PAGE_INFINITE', emoji: '♾️' },
  { minutes: 30,   labelKey: 'WHITE_NOISE_PAGE_30_MIN',   emoji: '⏱️' },
  { minutes: 60,   labelKey: 'WHITE_NOISE_PAGE_60_MIN',   emoji: '⏱️' },
];

const formatRemaining = (endAt: number): string => {
  const remainingSec = Math.max(0, Math.round((endAt - Date.now()) / 1000));
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const WhiteNoisePage = () => {
  const { t } = useTranslation();
  const [playingType, setPlayingType] = useState<TNoiseType | null>(whiteNoisePlayer.getPlayingType());
  const [endAt, setEndAt] = useState<number | null>(whiteNoisePlayer.getEndAt());
  const [activeDuration, setActiveDuration] = useState<number | null>(whiteNoisePlayer.getActiveDurationMinutes());
  const [, setTick] = useState(0);

  useEffect(() => {
    return whiteNoisePlayer.subscribe(() => {
      setPlayingType(whiteNoisePlayer.getPlayingType());
      setEndAt(whiteNoisePlayer.getEndAt());
      setActiveDuration(whiteNoisePlayer.getActiveDurationMinutes());
    });
  }, []);

  useEffect(() => {
    if (endAt === null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [endAt]);

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
      <p className={styles.subtitle}>{t('WHITE_NOISE_PAGE_SUBTITLE')}</p>
      <div className={styles.list}>
        {SOUNDS.map(({ type, emoji, titleKey }) => (
          <section key={type} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardEmoji}>{emoji}</span>
              <h2 className={styles.cardTitle}>{t(titleKey)}</h2>
            </div>
            <div className={styles.btnRow}>
              {DURATION_OPTIONS.map((option) => {
                const isActive = playingType === type && activeDuration === option.minutes;
                const text = isActive
                  ? (option.minutes !== null && endAt !== null ? formatRemaining(endAt) : t('WHITE_NOISE_PAGE_STOP'))
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

