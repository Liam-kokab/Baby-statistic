import { useInstallPrompt } from '../../utils/useInstallPrompt';
import { useTranslation } from '../../i18n/i18n';
import styles from './InstallBanner.module.css';

const InstallBanner = () => {
  const { canInstall, install, dismiss } = useInstallPrompt();
  const { t } = useTranslation();

  return canInstall ? (
    <div className={styles.banner}>
      <span className={styles.icon}>🌸</span>
      <div className={styles.text}>
        <strong>{t('INSTALL_BANNER_TITLE')}</strong>
        <span>{t('INSTALL_BANNER_SUBTITLE')}</span>
      </div>
      <button className={styles.installBtn} onClick={install}>{t('INSTALL_BANNER_INSTALL')}</button>
      <button className={styles.dismissBtn} onClick={dismiss} aria-label={t('INSTALL_BANNER_DISMISS')}>✕</button>
    </div>
  ) : null;
};

export default InstallBanner;

