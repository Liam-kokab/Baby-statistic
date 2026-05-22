import { useState, useEffect } from 'react';
import { fetch2 } from 'baby-statistic-common/util';
import PageLayout from '../../components/PageLayout/PageLayout';
import styles from './BuildInfoPage.module.css';

type TBuildTimeResponse = {
  buildTime: string;
};

const formatBuildTime = (iso: string): string => {
  if (iso === 'unknown') return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'medium' });
};

const BuildInfoPage = () => {
  const [serverBuildTime, setServerBuildTime] = useState<string>('loading...');
  const clientBuildTime = __CLIENT_BUILD_TIME__;

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

  return (
    <PageLayout title="Settings" emoji="⚙️">
      <div className={styles.card}>
        <div className={styles.row}>
          <span className={styles.label}>Frontend</span>
          <span className={styles.value}>{formatBuildTime(clientBuildTime)}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Backend</span>
          <span className={styles.value}>{formatBuildTime(serverBuildTime)}</span>
        </div>
      </div>
    </PageLayout>
  );
};

export default BuildInfoPage;


