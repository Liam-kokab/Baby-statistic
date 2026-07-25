import { useState, useEffect } from 'react';
import { authFetch } from '../../utils/authFetch';
import { authStore } from '../../utils/authStore';
import PageLayout from '../../components/PageLayout/PageLayout';
import Toggle from '../../components/Toggle/Toggle';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import { useActionFeedback } from '../../utils/useActionFeedback';
import type { TUser, TUpdateMeRequest } from 'baby-statistic-common';
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

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileAction = useActionFeedback();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordAction = useActionFeedback();

  useEffect(() => {
    const load = async (): Promise<void> => {
      const res = await authFetch<TBuildTimeResponse>('/api/build-time');
      if (res.ok) {
        setServerBuildTime(res.data.buildTime);
      } else {
        setServerBuildTime('error');
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadUser = async (): Promise<void> => {
      const res = await authFetch<TUser>('/api/auth/me');
      if (res.ok) {
        setDisplayName(res.data.name);
        setUsername(res.data.username);
        authStore.updateUser(res.data);
      }
    };
    loadUser();
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

  const handleSaveProfile = (): void => {
    setProfileError(null);
    profileAction.run(async () => {
      const body: TUpdateMeRequest = { name: displayName.trim(), username: username.trim() };
      const res = await authFetch<TUser>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
      if (!res.ok) {
        setProfileError(res.error);
        return false;
      }
      setDisplayName(res.data.name);
      setUsername(res.data.username);
      authStore.updateUser(res.data);
      return true;
    });
  };

  const handleChangePassword = (): void => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    passwordAction.run(async () => {
      const body: TUpdateMeRequest = { currentPassword, newPassword };
      const res = await authFetch<TUser>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(body) });
      if (!res.ok) {
        setPasswordError(res.error);
        return false;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      return true;
    });
  };

  return (
    <PageLayout title="Settings" emoji="⚙️">
      <div className={styles.content}>
      {/* Account card */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Account</h2>
        <div className={styles.formGrid}>
          <Input label="Display name" value={displayName} onChange={setDisplayName} name="displayName" placeholder="Your name" />
          <Input label="Username" value={username} onChange={setUsername} name="username" placeholder="Username" />
        </div>
        {profileError ? <p className={styles.formError}>{profileError}</p> : null}
        <div className={styles.formActions}>
          <Button text="Save profile" onClick={handleSaveProfile} status={profileAction.status} />
        </div>

        <h2 className={styles.sectionTitle}>Change Password</h2>
        <div className={styles.formGrid}>
          <Input label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword} name="currentPassword" placeholder="••••••••" />
          <Input label="New password" type="password" value={newPassword} onChange={setNewPassword} name="newPassword" placeholder="••••••••" />
          <Input label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} name="confirmPassword" placeholder="••••••••" />
        </div>
        {passwordError ? <p className={styles.formError}>{passwordError}</p> : null}
        <div className={styles.formActions}>
          <Button text="Change password" onClick={handleChangePassword} status={passwordAction.status} />
        </div>
      </section>

      {/* Appearance card */}
      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Appearance</h2>
        <div className={`${styles.row} ${styles.rowStack}`}>
          <span className={styles.label}>Theme</span>
          <div className={`${styles.value} ${styles.control}`}>
            <Toggle
              options={["👧 Girl", "🌿 Neutral", "👦 Boy"]}
              value={themeIndex}
              onChange={onThemeChange}
            />
          </div>
        </div>

        <div className={`${styles.row} ${styles.rowStack}`}>
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

