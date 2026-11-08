import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../utils/authFetch';
import { authStore } from '../../utils/authStore';
import PageLayout from '../../components/PageLayout/PageLayout';
import Toggle from '../../components/Toggle/Toggle';
import Checkmark from '../../components/Checkmark/Checkmark';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Tabs from '../../components/Tabs/Tabs';
import NavOrderEditor from '../../components/NavOrderEditor/NavOrderEditor';
import HomeWidgetsEditor from '../../components/HomeWidgetsEditor/HomeWidgetsEditor';
import WhiteNoiseSoundsEditor from '../../components/WhiteNoiseSoundsEditor/WhiteNoiseSoundsEditor';
import { useActionFeedback } from '../../utils/useActionFeedback';
import type { TUser, TBaby, TUpdateMeRequest, TApiKey, TCreateApiKeyRequest, TCreateApiKeyResponse } from 'baby-statistic-common';
import styles from './SettingsPage.module.css';
import { getSavedTheme, setTheme, themeToIndex, indexToTheme, getSavedMode, setMode, modeToIndex, indexToMode } from '../../utils/theme';
import { useTranslation, languageToIndex, indexToLanguage } from '../../i18n/i18n';
import {
  BLACK_SCREEN_FIELDS,
  getHiddenBlackScreenFields,
  saveHiddenBlackScreenFields,
  getBlackScreenOpacityPercent,
  saveBlackScreenOpacityPercent,
} from '../../utils/blackScreenPrefs';
import type { TBlackScreenField } from '../../utils/blackScreenPrefs';

type TBuildTimeResponse = {
  buildTime: string;
};

type TSettingsTab = 'account' | 'appearance' | 'navigation' | 'home' | 'apiKeys' | 'about';

const BLACK_SCREEN_FIELD_LABEL_KEYS: Record<TBlackScreenField, string> = {
  time:       'SETTINGS_BLACK_SCREEN_FIELD_TIME',
  sleep:      'SETTINGS_BLACK_SCREEN_FIELD_SLEEP',
  pump:       'SETTINGS_BLACK_SCREEN_FIELD_PUMP',
  bottle:     'SETTINGS_BLACK_SCREEN_FIELD_BOTTLE',
  todayMilk:  'SETTINGS_BLACK_SCREEN_FIELD_TODAY_MILK',
  medicines:  'SETTINGS_BLACK_SCREEN_FIELD_MEDICINES',
};

const SettingsPage = () => {
  const { t, language, setLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<TSettingsTab>('account');
  const [serverBuildTime, setServerBuildTime] = useState<string>(t('COMMON_LOADING_SIMPLE'));
  const clientBuildTime = __CLIENT_BUILD_TIME__;
  const [themeIndex, setThemeIndex] = useState<number>(() => themeToIndex(getSavedTheme() ?? 'neutral'));
  const [modeIndex, setModeIndex] = useState<number>(() => modeToIndex(getSavedMode() ?? 'auto'));
  const [languageIndex, setLanguageIndex] = useState<number>(() => languageToIndex(language));
  const [blackScreenHidden, setBlackScreenHidden] = useState<Set<TBlackScreenField>>(
    () => new Set(getHiddenBlackScreenFields())
  );
  const [blackScreenOpacityPercent, setBlackScreenOpacityPercent] = useState<number>(() =>
    getBlackScreenOpacityPercent()
  );

  const formatBuildTime = (iso: string): string => {
    if (iso === 'unknown') return t('SETTINGS_UNKNOWN');
    const d = new Date(iso);
    return d.toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'medium' });
  };

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const profileAction = useActionFeedback();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const passwordAction = useActionFeedback();

  // Baby-scoped API keys (e.g. for the MCP server) — every user assigned to this
  // baby can create/revoke keys; a key never expires and grants the same
  // access as this baby's own account, restricted to exactly this baby.
  const [apiKeys, setApiKeys] = useState<TApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [apiKeyName, setApiKeyName] = useState('');
  const [newlyCreatedApiKey, setNewlyCreatedApiKey] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const res = await authFetch<TBuildTimeResponse>('/api/build-time');
      if (res.ok) {
        setServerBuildTime(res.data.buildTime);
      } else {
        setServerBuildTime(t('SETTINGS_ERROR'));
      }
    };
    load();
  }, [t]);

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

  const loadApiKeys = useCallback(async () => {
    const res = await authFetch<TApiKey[]>('/api/baby/api-keys');
    if (res.ok) setApiKeys(res.data);
    else setApiKeyError(res.error);
    setApiKeysLoading(false);
  }, []);

  useEffect(() => { loadApiKeys(); }, [loadApiKeys]);

  const onThemeChange = (i: number): void => {
    const th = indexToTheme(i);
    setTheme(th);
    setThemeIndex(i);
  };

  const onModeChange = (i: number): void => {
    const m = indexToMode(i);
    setMode(m);
    setModeIndex(i);
  };

  const onLanguageChange = (i: number): void => {
    setLanguage(indexToLanguage(i));
    setLanguageIndex(i);
  };

  const onBlackScreenFieldToggle = (field: TBlackScreenField): void => {
    const next = new Set(blackScreenHidden);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setBlackScreenHidden(next);
    saveHiddenBlackScreenFields(Array.from(next));
  };

  const onBlackScreenOpacityChange = (percent: number): void => {
    saveBlackScreenOpacityPercent(percent);
    setBlackScreenOpacityPercent(percent);
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
      setPasswordError(t('SETTINGS_PASSWORD_TOO_SHORT'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('SETTINGS_PASSWORD_MISMATCH'));
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

  const handleAddApiKey = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!apiKeyName.trim()) return;
    setApiKeyError(null);
    setNewlyCreatedApiKey(null);
    const res = await authFetch<TCreateApiKeyResponse>('/api/baby/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: apiKeyName.trim() } satisfies TCreateApiKeyRequest),
    });
    if (res.ok) {
      setApiKeyName('');
      setNewlyCreatedApiKey(res.data.key);
      loadApiKeys();
    } else {
      setApiKeyError(res.error);
    }
  };

  const handleDeleteApiKey = async (id: number): Promise<void> => {
    if (!confirm(t('SETTINGS_CONFIRM_DELETE_API_KEY'))) return;
    await authFetch(`/api/baby/api-keys/${id}`, { method: 'DELETE' });
    loadApiKeys();
  };

  return (
    <PageLayout title={t('SETTINGS_TITLE')} emoji="⚙️" bannerSlug="settings">
      <div className={styles.content}>
      <Tabs
        tabs={[
          { key: 'account',    emoji: '👤', label: t('SETTINGS_TAB_ACCOUNT') },
          { key: 'appearance', emoji: '🎨', label: t('SETTINGS_TAB_APPEARANCE') },
          { key: 'navigation', emoji: '🧭', label: t('SETTINGS_TAB_NAVIGATION') },
          { key: 'home',       emoji: '🏠', label: t('SETTINGS_TAB_HOME') },
          { key: 'apiKeys',    emoji: '🗝️', label: t('SETTINGS_TAB_API_KEYS') },
          { key: 'about',      emoji: 'ℹ️', label: t('SETTINGS_TAB_ABOUT') },
        ]}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TSettingsTab)}
      />

      {activeTab === 'account' ? (
        <>
          {/* Account card */}
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('SETTINGS_ACCOUNT')}</h2>
            <div className={styles.formGrid}>
              <Input label={t('SETTINGS_DISPLAY_NAME')} value={displayName} onChange={setDisplayName} name="displayName" placeholder={t('SETTINGS_DISPLAY_NAME_PLACEHOLDER')} />
              <Input label={t('SETTINGS_USERNAME')} value={username} onChange={setUsername} name="username" placeholder={t('SETTINGS_USERNAME_PLACEHOLDER')} />
            </div>
            {profileError ? <p className={styles.formError}>{profileError}</p> : null}
            <div className={styles.formActions}>
              <Button text={t('SETTINGS_SAVE_PROFILE')} onClick={handleSaveProfile} status={profileAction.status} />
            </div>
          </section>

          {/* Change Password card */}
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('SETTINGS_CHANGE_PASSWORD_TITLE')}</h2>
            <div className={styles.formGrid}>
              <Input label={t('SETTINGS_CURRENT_PASSWORD')} type="password" value={currentPassword} onChange={setCurrentPassword} name="currentPassword" placeholder="••••••••" />
              <Input label={t('SETTINGS_NEW_PASSWORD')} type="password" value={newPassword} onChange={setNewPassword} name="newPassword" placeholder="••••••••" />
              <Input label={t('SETTINGS_CONFIRM_NEW_PASSWORD')} type="password" value={confirmPassword} onChange={setConfirmPassword} name="confirmPassword" placeholder="••••••••" />
            </div>
            {passwordError ? <p className={styles.formError}>{passwordError}</p> : null}
            <div className={styles.formActions}>
              <Button text={t('SETTINGS_CHANGE_PASSWORD')} onClick={handleChangePassword} status={passwordAction.status} />
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'appearance' ? (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>{t('SETTINGS_APPEARANCE')}</h2>
          <div className={`${styles.row} ${styles.rowStack}`}>
            <span className={styles.label}>{t('SETTINGS_THEME')}</span>
            <div className={`${styles.value} ${styles.control}`}>
              <Toggle
                options={[t('SETTINGS_THEME_GIRL'), t('SETTINGS_THEME_NEUTRAL'), t('SETTINGS_THEME_BOY')]}
                value={themeIndex}
                onChange={onThemeChange}
              />
            </div>
          </div>

          <div className={`${styles.row} ${styles.rowStack}`}>
            <span className={styles.label}>{t('SETTINGS_MODE')}</span>
            <div className={`${styles.value} ${styles.control}`}>
              <Toggle
                options={[t('SETTINGS_MODE_LIGHT'), t('SETTINGS_MODE_AUTO'), t('SETTINGS_MODE_DARK')]}
                value={modeIndex}
                onChange={onModeChange}
              />
            </div>
          </div>

          <div className={`${styles.row} ${styles.rowStack}`}>
            <span className={styles.label}>{t('SETTINGS_LANGUAGE')}</span>
            <div className={`${styles.value} ${styles.control}`}>
              <Toggle
                options={[t('SETTINGS_LANGUAGE_ENGLISH'), t('SETTINGS_LANGUAGE_BOKMAL')]}
                value={languageIndex}
                onChange={onLanguageChange}
              />
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'navigation' ? (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>{t('SETTINGS_TAB_NAVIGATION')}</h2>
          <NavOrderEditor />
        </section>
      ) : null}

      {activeTab === 'home' ? (
        <>
          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('SETTINGS_TAB_HOME')}</h2>
            <HomeWidgetsEditor />
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('SETTINGS_WHITE_NOISE_SOUNDS_TITLE')}</h2>
            <WhiteNoiseSoundsEditor />
          </section>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>{t('SETTINGS_BLACK_SCREEN_TITLE')}</h2>
            <p className={styles.description}>{t('SETTINGS_BLACK_SCREEN_FIELDS_DESCRIPTION')}</p>
            <div className={styles.formGrid}>
              {BLACK_SCREEN_FIELDS.map((field) => (
                <Checkmark
                  key={field}
                  checked={!blackScreenHidden.has(field)}
                  onChange={() => onBlackScreenFieldToggle(field)}
                  label={t(BLACK_SCREEN_FIELD_LABEL_KEYS[field])}
                />
              ))}
            </div>

            <div className={`${styles.row} ${styles.rowStack}`}>
              <span className={styles.label}>{t('SETTINGS_BLACK_SCREEN_OPACITY')}</span>
              <p className={styles.description}>{t('SETTINGS_BLACK_SCREEN_OPACITY_DESCRIPTION')}</p>
              <div className={`${styles.value} ${styles.control} ${styles.sliderControl}`}>
                <input
                  type="range"
                  className={styles.rangeSlider}
                  min={0}
                  max={100}
                  step={1}
                  value={blackScreenOpacityPercent}
                  onChange={(e) => onBlackScreenOpacityChange(Number(e.target.value))}
                  aria-label={t('SETTINGS_BLACK_SCREEN_OPACITY')}
                />
                <span className={styles.sliderValue}>{blackScreenOpacityPercent}%</span>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'apiKeys' ? (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>{t('SETTINGS_API_KEYS_TITLE')}</h2>
          <p className={styles.description}>{t('SETTINGS_API_KEYS_DESCRIPTION')}</p>

          <form onSubmit={handleAddApiKey} className={styles.addForm}>
            <Input
              value={apiKeyName}
              onChange={setApiKeyName}
              name="apiKeyName"
              placeholder={t('SETTINGS_API_KEY_NAME_PLACEHOLDER')}
            />
            <Button text={t('COMMON_ADD')} type="submit" />
          </form>

          {apiKeyError ? <p className={styles.formError}>{apiKeyError}</p> : null}

          {newlyCreatedApiKey ? (
            <div className={styles.newKeyBanner}>
              <span className={styles.newKeyLabel}>{t('SETTINGS_API_KEY_SHOWN_ONCE')}</span>
              <div className={styles.newKeyRow}>
                <code className={styles.newKeyValue}>{newlyCreatedApiKey}</code>
              </div>
            </div>
          ) : null}

          {apiKeysLoading ? (
            <p className={styles.description}>{t('COMMON_LOADING_SIMPLE')}</p>
          ) : apiKeys.length === 0 ? (
            <p className={styles.description}>{t('SETTINGS_NO_API_KEYS_YET')}</p>
          ) : (
            <ul className={styles.apiKeyList}>
              {apiKeys.map((k) => (
                <li key={k.id} className={styles.apiKeyItem}>
                  <span className={styles.apiKeyName}>🔑 {k.name}</span>
                  <span className={styles.apiKeyMeta}>{k.createdAt.slice(0, 10)}</span>
                  <button className={styles.apiKeyDeleteBtn} onClick={() => handleDeleteApiKey(k.id)}>🗑️</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {activeTab === 'about' ? (
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>{t('SETTINGS_BUILD_INFO')}</h2>
          <div className={styles.row}>
            <span className={styles.label}>{t('SETTINGS_FRONTEND')}</span>
            <span className={styles.value}>{formatBuildTime(clientBuildTime)}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>{t('SETTINGS_BACKEND')}</span>
            <span className={styles.value}>{formatBuildTime(serverBuildTime)}</span>
          </div>
        </section>
      ) : null}
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
