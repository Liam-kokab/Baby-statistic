import { useInstallPrompt } from '../../utils/useInstallPrompt';
import styles from './InstallBanner.module.css';

const InstallBanner = () => {
  const { canInstall, install, dismiss } = useInstallPrompt();

  return canInstall ? (
    <div className={styles.banner}>
      <span className={styles.icon}>🌸</span>
      <div className={styles.text}>
        <strong>Install Baby Stats</strong>
        <span>Add to your home screen for quick access</span>
      </div>
      <button className={styles.installBtn} onClick={install}>Install</button>
      <button className={styles.dismissBtn} onClick={dismiss} aria-label="Dismiss">✕</button>
    </div>
  ) : null;
};

export default InstallBanner;

