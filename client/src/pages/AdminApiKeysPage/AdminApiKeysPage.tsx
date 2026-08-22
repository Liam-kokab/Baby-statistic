import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../utils/authFetch';
import type { TApiKey, TCreateApiKeyRequest, TCreateApiKeyResponse } from 'baby-statistic-common';
import { useTranslation } from '../../i18n/i18n';
import styles from './AdminApiKeysPage.module.css';

const AdminApiKeysPage = () => {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState<TApiKey[]>([]);
  const [newName, setNewName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await authFetch<TApiKey[]>('/api/admin/api-keys');
    if (res.ok) setApiKeys(res.data);
    else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setNewlyCreatedKey(null);
    const res = await authFetch<TCreateApiKeyResponse>('/api/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim() } satisfies TCreateApiKeyRequest),
    });
    if (res.ok) {
      setNewName('');
      setNewlyCreatedKey(res.data.key);
      load();
    } else {
      setError(res.error);
    }
  }, [newName, load]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm(t('ADMIN_CONFIRM_DELETE_API_KEY'))) return;
    await authFetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    load();
  }, [load]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('ADMIN_API_KEYS_TITLE')}</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input
          className={styles.input}
          placeholder={t('ADMIN_API_KEY_NAME_PLACEHOLDER')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className={styles.addBtn} type="submit">{t('COMMON_ADD')}</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {newlyCreatedKey ? (
        <div className={styles.newKeyBanner}>
          <span className={styles.newKeyLabel}>{t('ADMIN_API_KEY_SHOWN_ONCE')}</span>
          <div className={styles.newKeyRow}>
            <code className={styles.newKeyValue}>{newlyCreatedKey}</code>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className={styles.empty}>{t('COMMON_LOADING_SIMPLE')}</p>
      ) : apiKeys.length === 0 ? (
        <p className={styles.empty}>{t('ADMIN_NO_API_KEYS_YET')}</p>
      ) : (
        <ul className={styles.list}>
          {apiKeys.map((k) => (
            <li key={k.id} className={styles.item}>
              <span className={styles.name}>🔑 {k.name}</span>
              <span className={styles.meta}>{k.createdAt.slice(0, 10)}</span>
              <button className={styles.deleteBtn} onClick={() => handleDelete(k.id)}>🗑️</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminApiKeysPage;

