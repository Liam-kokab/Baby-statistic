import { useState, useEffect } from 'react';
import { fetch2 } from 'baby-statistic-common/util';
import PageLayout from '../../components/PageLayout/PageLayout';
import Toggle from '../../components/Toggle/Toggle';
import styles from './SettingsPage.module.css';
import { getSavedTheme, setTheme, themeToIndex, indexToTheme, getSavedMode, setMode, modeToIndex, indexToMode } from '../../utils/theme';

type TBuildTimeResponse = {
  buildTime: string;
};

const formatBuildTime = (iso: string): string => {
  if (iso === 'unknown') return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'medium' });
};

const SettingsPage = () => {
  const [serverBuildTime, setServerBuildTime] = useState<string>('loading...');
  const clientBuildTime = __CLIENT_BUILD_TIME__;
  const [themeIndex, setThemeIndex] = useState<number>(() => themeToIndex(getSavedTheme() ?? 'neutral'));
  const [modeIndex, setModeIndex] = useState<number>(() => modeToIndex(getSavedMode() ?? 'auto'));

  useEffect(() => {
    const load = async (): Promise<void> => {
      const res = await fetch2<TBuildTimeResponse>('/api/build-time');
      if (res.ok) {
        setServerBuildTime(res.data.buildTime);
      } else {
        setServerBuildTime('error');
      }
    };
    load();
  }, []);

  const onThemeChange = (i: number): void => {
    const t = indexToTheme(i);
    setTheme(t);
    setThemeIndex(i);
  };

  const onModeChange = (i: number): void => {
    const m = indexToMode(i);
    setMode(m);
    setModeIndex(i);
  };

  return (
    <PageLayout title="Settings" emoji="⚙️">
      <div className={styles.content}>
      {/* Appearance card */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <div className={styles.row}>
          <span className={styles.label}>Theme</span>
          <div className={`${styles.value} ${styles.control}`}>
            <Toggle
              options={["👧 Girl", "🌿 Neutral", "👦 Boy"]}
              value={themeIndex}
              onChange={onThemeChange}
            />
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Mode</span>
          <div className={`${styles.value} ${styles.control}`}>
            <Toggle
              options={["🌞 Light", "⚙️ Auto", "🌙 Dark"]}
              value={modeIndex}
              onChange={onModeChange}
            />
          </div>
        </div>
      </section>

      {/* Build & Info card */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Build & Info</h2>
        <div className={styles.row}>
          <span className={styles.label}>Frontend</span>
          <span className={styles.value}>{formatBuildTime(clientBuildTime)}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Backend</span>
          <span className={styles.value}>{formatBuildTime(serverBuildTime)}</span>
        </div>
      </section>

      {/* Advanced card removed */}
      </div>
    </PageLayout>
  );
};

export default SettingsPage;

