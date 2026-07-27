import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../../utils/authFetch';
import type { TUser, TBaby, TAdminCreateUser, TAdminUpdateUser } from 'baby-statistic-common';
import { useTranslation } from '../../i18n/i18n';
import styles from './AdminUsersPage.module.css';

type TCreateForm = {
  username: string;
  password: string;
  role: 'user' | 'admin';
  babyId: string;
  name: string;
};

const EMPTY_FORM: TCreateForm = { username: '', password: '', role: 'user', babyId: '', name: '' };

const AdminUsersPage = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<TUser[]>([]);
  const [babies, setBabies] = useState<TBaby[]>([]);
  const [form, setForm] = useState<TCreateForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [passwordId, setPasswordId] = useState<number | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [usersRes, babiesRes] = await Promise.all([
      authFetch<TUser[]>('/api/admin/users'),
      authFetch<TBaby[]>('/api/admin/babies'),
    ]);
    if (usersRes.ok) setUsers(usersRes.data);
    if (babiesRes.ok) setBabies(babiesRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: TAdminCreateUser & { password: string; name: string } = {
      username: form.username.trim(),
      password: form.password,
      role: form.role,
      babyId: form.role === 'user' ? Number(form.babyId) : null,
      name: form.name.trim(),
    };
    const res = await authFetch<TUser>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setForm(EMPTY_FORM);
      load();
    } else {
      setError(res.error);
    }
  }, [form, load]);

  const handleSaveEdit = useCallback(async (id: number) => {
    setEditError(null);
    const body: TAdminUpdateUser = { name: editName.trim(), username: editUsername.trim() };
    const res = await authFetch<TUser>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditingId(null);
      load();
    } else {
      setEditError(res.error);
    }
  }, [editName, editUsername, load]);

  const handleSavePassword = useCallback(async (id: number) => {
    setPasswordError(null);
    if (passwordValue.length < 8) {
      setPasswordError(t('ADMIN_PASSWORD_MIN_LENGTH'));
      return;
    }
    const body: TAdminUpdateUser = { password: passwordValue };
    const res = await authFetch<TUser>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setPasswordId(null);
      setPasswordValue('');
    } else {
      setPasswordError(res.error);
    }
  }, [passwordValue]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm(t('ADMIN_CONFIRM_DELETE_USER'))) return;
    await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    load();
  }, [load]);

  const babyName = (id: number | null) =>
    id == null ? '—' : (babies.find((b) => b.id === id)?.name ?? `id:${id}`);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t('ADMIN_USERS_TITLE')}</h1>

      <form onSubmit={handleAdd} className={styles.addForm}>
        <input className={styles.input} placeholder={t('ADMIN_DISPLAY_NAME_PLACEHOLDER')} value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <input className={styles.input} placeholder={t('ADMIN_USERNAME_PLACEHOLDER')} value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} required />
        <input className={styles.input} placeholder={t('ADMIN_PASSWORD_PLACEHOLDER')} type="password" value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
        <select className={styles.input} value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'user' | 'admin' }))}>
          <option value="user">{t('ADMIN_ROLE_USER')}</option>
          <option value="admin">{t('ADMIN_ROLE_ADMIN')}</option>
        </select>
        {form.role === 'user' ? (
          <select className={styles.input} value={form.babyId}
            onChange={(e) => setForm((f) => ({ ...f, babyId: e.target.value }))} required>
            <option value="">{t('ADMIN_SELECT_BABY')}</option>
            {babies.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : null}
        <button className={styles.addBtn} type="submit">{t('COMMON_ADD')}</button>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <p className={styles.empty}>{t('COMMON_LOADING_SIMPLE')}</p>
      ) : users.length === 0 ? (
        <p className={styles.empty}>{t('ADMIN_NO_USERS_YET')}</p>
      ) : (
        <ul className={styles.list}>
          {users.map((u) => (
            <li key={u.id} className={styles.item}>
              <div className={styles.itemTop}>
                <span className={`${styles.role} ${u.role === 'admin' ? styles.roleAdmin : styles.roleUser}`}>
                  {u.role === 'admin' ? '🔑' : '👤'}
                </span>
                <span className={styles.name}>{u.username}</span>
                <span className={styles.meta}>{u.name ? u.name : <em>{t('ADMIN_NO_NAME')}</em>}</span>
                <span className={styles.meta}>{u.role === 'user' ? `👶 ${babyName(u.babyId)}` : t('ADMIN_ROLE_ADMIN')}</span>
                <button
                  className={styles.editBtn}
                  title={t('ADMIN_EDIT_NAME_USERNAME')}
                  onClick={() => {
                    setEditingId(u.id);
                    setEditName(u.name ?? '');
                    setEditUsername(u.username);
                    setEditError(null);
                    setPasswordId(null);
                  }}
                >✏️</button>
                <button
                  className={styles.editBtn}
                  title={t('ADMIN_SET_NEW_PASSWORD')}
                  onClick={() => {
                    setPasswordId(u.id);
                    setPasswordValue('');
                    setPasswordError(null);
                    setEditingId(null);
                  }}
                >🔒</button>
                <button className={styles.deleteBtn} onClick={() => handleDelete(u.id)}>🗑️</button>
              </div>

              {editingId === u.id ? (
                <div className={styles.editRow}>
                  <input
                    className={styles.editInput}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t('ADMIN_DISPLAY_NAME_PLACEHOLDER')}
                    autoFocus
                  />
                  <input
                    className={styles.editInput}
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder={t('ADMIN_USERNAME_PLACEHOLDER')}
                  />
                  <button className={styles.saveBtn} onClick={() => handleSaveEdit(u.id)}>✓</button>
                  <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>✕</button>
                  {editError ? <span className={styles.error}>{editError}</span> : null}
                </div>
              ) : null}

              {passwordId === u.id ? (
                <div className={styles.editRow}>
                  <input
                    className={styles.editInput}
                    type="password"
                    value={passwordValue}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    placeholder={t('ADMIN_NEW_PASSWORD_PLACEHOLDER')}
                    autoFocus
                  />
                  <button className={styles.saveBtn} onClick={() => handleSavePassword(u.id)}>✓</button>
                  <button className={styles.cancelBtn} onClick={() => setPasswordId(null)}>✕</button>
                  {passwordError ? <span className={styles.error}>{passwordError}</span> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

      )}
    </div>
  );
};

export default AdminUsersPage;

