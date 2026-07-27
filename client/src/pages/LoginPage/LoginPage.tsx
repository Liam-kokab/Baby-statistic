import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TLoginRequest, TLoginResponse } from 'baby-statistic-common';
import { authStore } from '../../utils/authStore';
import { useTranslation } from '../../i18n/i18n';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password } satisfies TLoginRequest),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? t('LOGIN_FAILED'));
        return;
      }

      const data = await res.json() as TLoginResponse;
      authStore.setTokens(data.accessToken, data.refreshToken, data.user);
      navigate('/', { replace: true });
    } catch {
      setError(t('LOGIN_NETWORK_ERROR'));
    } finally {
      setLoading(false);
    }
  }, [username, password, navigate, t]);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.emoji}>👶</div>
        <h1 className={styles.title}>{t('LOGIN_TITLE')}</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            {t('LOGIN_USERNAME')}
            <input
              className={styles.input}
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </label>
          <label className={styles.label}>
            {t('LOGIN_PASSWORD')}
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </label>
          {error ? <p className={styles.error}>{error}</p> : null}
          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? t('LOGIN_SIGNING_IN') : t('LOGIN_SIGN_IN')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

